#!/usr/bin/env bun

// This repository's Simple Changes `execGuard` (see .simple-changes.json).
// `loop exec` runs `bun tooling/exec-guard.ts <command...>` before the
// command. The repository has no CI or Git hooks, so this guard is its merge
// gate: it refuses a merge-like command unless a passing `bun run check`
// receipt (tooling/check-receipt.ts) exists for the exact head being merged
// or pushed, and exits 0 for every command it does not gate.
//
// Gated:
// - a provider merge: `glab api .../merge_requests/<iid>/merge` with
//   `-f sha=<head>`, `glab mr merge --sha <head>`, `gh pr merge
//   --match-head-commit <head>`, or `gh api .../pulls/<n>/merge` with
//   `-f sha=<head>`; a merge that pins no head is refused;
// - `git merge` while the target branch is checked out, for each merged
//   revision (MERGE_HEAD for --continue, the upstream with no revision);
// - `git push` that updates the target branch on any remote, for the pushed
//   commit; deleting it or a wildcard refspec is refused.
//
// Boundary: the guard reads the exec argv. A merge or push hidden in another
// program (a shell script, an alias, a wrapper) is refused when an argument
// reads as one, and otherwise not seen; only commands run through
// `loop exec` are guarded at all. Local branch moves other than `git merge`
// (commit, reset, rebase) are not gated; the push that publishes them is. A
// receipt proves the head passed `bun run check`; the merge result equals
// that head only when the head already contains the target tip.

import { basename, resolve } from "node:path";
import {
  commonDirectory,
  gitOutput,
  hasPassingReceipt,
  RECEIPT_COMMAND,
} from "./check-receipt.ts";

type Gate =
  | { kind: "allow" }
  | { kind: "refuse"; reason: string }
  | { cwd: string; kind: "require"; label: string; revisions: string[] };

const ALLOW: Gate = { kind: "allow" };
const refuse = (reason: string): Gate => ({ kind: "refuse", reason });

const DEFAULT_TARGET = "main";
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/u;
// "merge" or "push" as a word, or a merge API path ending in /merge.
const OPAQUE_MERGE_PATTERN = /(?:^|[\s"'/;&|(])(?:merge|push)(?:[\s"';&|)]|$)/u;
const GITLAB_MERGE_PATH =
  /(?:^|\/)projects\/[^/]+\/merge_requests\/\d+\/merge$/u;
const GITHUB_MERGE_PATH = /(?:^|\/)repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge$/u;
const HEADS_PREFIX = "refs/heads/";
const FORCE_PREFIX = /^\+/u;

// Options that take the next argument as their value.
const GIT_VALUE_OPTIONS = new Set(["-c", "--config-env", "--namespace"]);
const GIT_REPOSITORY_OPTIONS = ["--git-dir", "--work-tree"];
const MERGE_VALUE_OPTIONS = new Set([
  "-F",
  "-X",
  "-m",
  "-s",
  "--file",
  "--into-name",
  "--strategy",
  "--strategy-option",
]);
const PUSH_VALUE_OPTIONS = new Set([
  "-o",
  "--exec",
  "--push-option",
  "--receive-pack",
  "--repo",
]);
const API_VALUE_OPTIONS = new Set([
  "-F",
  "-H",
  "-X",
  "-f",
  "--field",
  "--header",
  "--hostname",
  "--input",
  "--method",
  "--raw-field",
]);
const API_FIELD_OPTIONS = ["-F", "-f", "--field", "--raw-field"];

// Every `-f k=v`, `-fk=v`, or `--raw-field=k=v` value, in order.
const fieldValues = (args: string[]): string[] =>
  args.flatMap((arg, index) => {
    if (API_FIELD_OPTIONS.includes(args[index - 1] ?? "")) {
      return [arg];
    }
    const option = API_FIELD_OPTIONS.find((name) =>
      arg.startsWith(name.length === 2 ? name : `${name}=`)
    );
    if (option === undefined || arg === option) {
      return [];
    }
    return [arg.slice(option.length === 2 ? 2 : option.length + 1)];
  });

/** Positional arguments, skipping each value option's value. */
const positionals = (args: string[], valueOptions: Set<string>): string[] => {
  const found: string[] = [];
  let value = false;
  for (const arg of args) {
    if (value) {
      value = false;
    } else if (valueOptions.has(arg)) {
      value = true;
    } else if (!arg.startsWith("-")) {
      found.push(arg);
    }
  }
  return found;
};

const currentBranch = (cwd: string): string | null =>
  gitOutput(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);

/** The value of `name`, given as `name value` or `name=value`. */
const optionValue = (args: string[], name: string): string | undefined => {
  for (const [index, arg] of args.entries()) {
    if (arg === name) {
      return args[index + 1];
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
};

const targetBranch = (cwd: string): string =>
  gitOutput(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ])
    ?.split("/")
    .slice(1)
    .join("/") || DEFAULT_TARGET;

const branchName = (ref: string): string =>
  ref.startsWith(HEADS_PREFIX) ? ref.slice(HEADS_PREFIX.length) : ref;

const gitMerge = (cwd: string, args: string[]): Gate => {
  const target = targetBranch(cwd);
  const current = currentBranch(cwd);
  if (
    current !== target ||
    args.includes("--abort") ||
    args.includes("--quit")
  ) {
    return ALLOW;
  }
  const named = positionals(args, MERGE_VALUE_OPTIONS);
  let revisions = named.length > 0 ? named : ["@{upstream}"];
  if (args.includes("--continue")) {
    revisions = ["MERGE_HEAD"];
  }
  return { cwd, kind: "require", label: `git merge into ${target}`, revisions };
};

// The pushed source of every refspec whose destination is the target.
const pushedToTarget = (
  cwd: string,
  refspecs: string[],
  target: string
): Gate => {
  const current = currentBranch(cwd);
  const revisions: string[] = [];
  for (const refspec of refspecs) {
    const spec = refspec.replace(FORCE_PREFIX, "");
    if (spec.includes("*")) {
      return refuse(`a wildcard refspec (${refspec}) could update ${target}`);
    }
    const [source = "", destination = source] = spec.split(":");
    const named = branchName(
      destination === "HEAD" ? (current ?? "") : destination
    );
    if (named === target) {
      if (source === "") {
        return refuse(`${refspec} would delete ${target}`);
      }
      revisions.push(source);
    }
  }
  return revisions.length > 0
    ? { cwd, kind: "require", label: `git push to ${target}`, revisions }
    : ALLOW;
};

const gitPush = (cwd: string, args: string[]): Gate => {
  if (args.includes("--dry-run") || args.includes("-n")) {
    return ALLOW;
  }
  const target = targetBranch(cwd);
  if (args.some((arg) => ["--all", "--branches", "--mirror"].includes(arg))) {
    return {
      cwd,
      kind: "require",
      label: `git push of every branch, ${target} included`,
      revisions: [`${HEADS_PREFIX}${target}`],
    };
  }
  if (args.includes("--delete") || args.includes("-d")) {
    return positionals(args, PUSH_VALUE_OPTIONS)
      .slice(1)
      .some((ref) => branchName(ref) === target)
      ? refuse(`git push --delete would delete ${target}`)
      : ALLOW;
  }
  const named = positionals(args, PUSH_VALUE_OPTIONS);
  // With --repo the remote is not positional.
  const refspecs =
    optionValue(args, "--repo") === undefined ? named.slice(1) : named;
  if (refspecs.length > 0) {
    return pushedToTarget(cwd, refspecs, target);
  }
  // No refspec: Git pushes the current branch to its push destination.
  const destination = gitOutput(cwd, ["rev-parse", "--abbrev-ref", "@{push}"]);
  const current = currentBranch(cwd);
  const pushes = destination?.split("/").slice(1).join("/") ?? current;
  return pushes === target || current === target
    ? {
        cwd,
        kind: "require",
        label: `git push to ${target}`,
        revisions: ["HEAD"],
      }
    : ALLOW;
};

const git = (checkout: string, args: string[]): Gate => {
  let cwd = checkout;
  let index = 0;
  while (index < args.length && (args[index] ?? "").startsWith("-")) {
    const option = args[index] ?? "";
    if (option === "-C") {
      cwd = resolve(cwd, args[index + 1] ?? ".");
      index += 2;
    } else if (GIT_REPOSITORY_OPTIONS.some((name) => option.startsWith(name))) {
      return args.some((arg) => arg === "merge" || arg === "push")
        ? refuse(`${option} hides which repository is merged or pushed`)
        : ALLOW;
    } else {
      index += GIT_VALUE_OPTIONS.has(option) ? 2 : 1;
    }
  }
  const subcommand = args[index];
  const rest = args.slice(index + 1);
  if (subcommand === "merge") {
    return gitMerge(cwd, rest);
  }
  return subcommand === "push" ? gitPush(cwd, rest) : ALLOW;
};

// A provider API merge call and the head it pins: `-f sha=<head>` or a
// `sha` query parameter.
const apiMerge = (
  cwd: string,
  args: string[],
  pattern: RegExp,
  label: string
): Gate => {
  const [endpoint = ""] = positionals(args, API_VALUE_OPTIONS);
  const [path = "", query = ""] = endpoint.split("?");
  if (!pattern.test(path)) {
    return ALLOW;
  }
  const sha =
    fieldValues(args)
      .find((field) => field.startsWith("sha="))
      ?.slice(4) ??
    new URLSearchParams(query).get("sha") ??
    undefined;
  return sha
    ? { cwd, kind: "require", label, revisions: [sha] }
    : refuse(`${label} must pin the head it merges with -f sha=<head>`);
};

const pinnedMerge = (
  cwd: string,
  args: string[],
  option: string,
  label: string
): Gate => {
  const sha = optionValue(args, option);
  return sha
    ? { cwd, kind: "require", label, revisions: [sha] }
    : refuse(`${label} must pin the head it merges with ${option} <head>`);
};

const glab = (cwd: string, args: string[]): Gate => {
  if (args[0] === "api") {
    return apiMerge(
      cwd,
      args.slice(1),
      GITLAB_MERGE_PATH,
      "a GitLab API merge"
    );
  }
  return args[0] === "mr" && args[1] === "merge"
    ? pinnedMerge(cwd, args.slice(2), "--sha", "glab mr merge")
    : ALLOW;
};

const gh = (cwd: string, args: string[]): Gate => {
  if (args[0] === "api") {
    return apiMerge(
      cwd,
      args.slice(1),
      GITHUB_MERGE_PATH,
      "a GitHub API merge"
    );
  }
  return args[0] === "pr" && args[1] === "merge"
    ? pinnedMerge(cwd, args.slice(2), "--match-head-commit", "gh pr merge")
    : ALLOW;
};

/** Decides whether the exec command is gated, and on which revisions. */
export const gateFor = (checkout: string, argv: string[]): Gate => {
  let command = argv;
  // `env NAME=value command`: the command is still direct argv.
  if (basename(command[0] ?? "") === "env") {
    const rest = command.slice(1);
    const start = rest.findIndex((arg) => !ENV_ASSIGNMENT_PATTERN.test(arg));
    command =
      start === -1 || (rest[start] ?? "").startsWith("-")
        ? command
        : rest.slice(start);
  }
  const [program = "", ...args] = command;
  switch (basename(program)) {
    case "git": {
      return git(checkout, args);
    }
    case "glab": {
      return glab(checkout, args);
    }
    case "gh": {
      return gh(checkout, args);
    }
    default: {
      // Any other program could wrap a merge; refuse when it reads as one.
      return args.some((arg) => OPAQUE_MERGE_PATTERN.test(arg))
        ? refuse(
            `${basename(program)} may run a merge or push the guard cannot inspect; run git, glab, or gh directly`
          )
        : ALLOW;
    }
  }
};

/** The refusal message, or null when the command may run. */
export const verdict = (checkout: string, argv: string[]): string | null => {
  const gate = gateFor(checkout, argv);
  if (gate.kind === "allow") {
    return null;
  }
  if (gate.kind === "refuse") {
    return gate.reason;
  }
  const common = commonDirectory(gate.cwd);
  for (const revision of gate.revisions) {
    const head = gitOutput(gate.cwd, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${revision}^{commit}`,
    ]);
    if (head === null || common === null) {
      return `${gate.label}: ${revision} does not resolve to a local commit; fetch it, then run bun run check:receipt on it`;
    }
    if (!hasPassingReceipt(common, head)) {
      return `${gate.label}: ${head} has no passing ${RECEIPT_COMMAND} receipt; check out that commit cleanly and run bun run check:receipt`;
    }
  }
  return null;
};

if (import.meta.main) {
  const reason = verdict(process.cwd(), process.argv.slice(2));
  if (reason !== null) {
    process.stderr.write(`exec guard: ${reason}\n`);
    process.exitCode = 1;
  }
}
