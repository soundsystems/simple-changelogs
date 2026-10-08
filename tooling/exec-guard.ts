#!/usr/bin/env bun

// This repository's Simple Changes `execGuard` (see .simple-changes.json).
// `loop exec` runs `bun tooling/exec-guard.ts <command...>` before the
// command. The repository has no CI or Git hooks, so this guard is its merge
// gate: it refuses a merge-like command unless a passing `bun run check`
// receipt (tooling/check-receipt.ts) exists for the exact head being merged
// or pushed, and exits 0 for every command it does not gate.
//
// Gated:
// - a provider merge: a mutating `glab api` call to a merge request's
//   `/merge` or merge-train endpoint, or a `gh api` call to a pull request's
//   `/merge` or `/merge-async`, pinned with `-f sha=<head>`; `glab mr merge
//   --sha <head>`; or `gh pr merge --match-head-commit <head>`, wherever the
//   subcommand sits among the flags. A merge that pins no head, a mutating
//   API call that writes refs, commits, or files directly, and a GraphQL
//   call that merges or writes refs are refused; reads pass;
// - `git push`: Git itself reports what the push would update (`git push
//   <args> --dry-run --porcelain --no-quiet`, with the same options and
//   configuration), and every update to the target branch on any remote
//   needs a receipt for the pushed commit. Deleting the target is refused,
//   and so is a push whose dry run fails, one with `--`, and one whose last
//   argument is an option;
// - `git merge` while the target branch is checked out, for each merged
//   revision (MERGE_HEAD for --continue, the upstream with no revision), and
//   `git pull` of a named branch into it;
// - `git send-pack`, `git http-push`, `git subtree push|pull|merge`, and a
//   Git alias that expands to a push, merge, or pull are refused.
//
// Boundary: the guard reads the exec argv. It inherits the environment the
// command runs with, and it refuses `env` assignments to GIT_ variables and
// provider merges that repeat their method, sha, or head option rather than
// model which one the CLI keeps. Another program whose arguments
// read as a Git or provider merge or push (a shell `-c` script, `timeout`,
// `bunx`) is refused; a merge hidden inside a script or package task is not
// seen, and only commands run through `loop exec` are guarded at all. Local
// branch moves other than `git merge` and `git pull` (commit, reset, rebase)
// are not gated; the push that publishes them is. Refs can move between the
// guard and the command it allowed, and host branch protection remains the
// control for provider API writes the guard does not list. A receipt proves
// the head passed `bun run check`; a merge result equals that head only when
// the head already contains the target tip.

import { basename } from "node:path";
import { spawnSync } from "bun";
import { hasPassingReceipt, RECEIPT_COMMAND } from "./check-receipt.ts";

// Git run as `git <global options> <args>` in the checkout, so `-C`, `-c`,
// `--git-dir`, and `--work-tree` apply to every lookup the guard makes.
interface GitContext {
  checkout: string;
  global: string[];
}

type Gate =
  | { kind: "allow" }
  | { kind: "refuse"; reason: string }
  | {
      context: GitContext;
      kind: "require";
      label: string;
      revisions: string[];
    };

const ALLOW: Gate = { kind: "allow" };
const refuse = (reason: string): Gate => ({ kind: "refuse", reason });
const requireReceipts = (
  context: GitContext,
  label: string,
  revisions: string[]
): Gate => ({ context, kind: "require", label, revisions });

const DEFAULT_TARGET = "main";
const HEADS_PREFIX = "refs/heads/";
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/u;
// One `git push --porcelain` ref line: flag, then `from:to`, then a summary.
const PORCELAIN_LINE = /^([ +\-*!=])\t([^\t]*)\t/u;
const MERGING_WORD = /\b(?:push|merge|pull|send-pack)\b/u;
// GraphQL mutations that merge or move a branch.
const GRAPHQL_REF_WRITE =
  /merge|updateRefs?\b|createCommitOnBranch|commitCreate|createRef|deleteRef/iu;
// REST endpoints that merge a change request: GitLab merge and merge trains,
// GitHub merge and asynchronous merge.
const API_MERGE_PATHS = [
  /(?:^|\/)projects\/[^/]+\/merge_requests\/\d+\/merge$/u,
  /(?:^|\/)projects\/[^/]+\/merge_trains\/merge_requests\/\d+$/u,
  /(?:^|\/)repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge(?:-async)?$/u,
];
// REST endpoints that write branches, commits, or files without a merge.
const API_REF_WRITE_PATHS = [
  /(?:^|\/)repos\/[^/]+\/[^/]+\/(?:merges|git\/refs|contents)(?:\/|$)/u,
  /(?:^|\/)projects\/[^/]+\/repository\/(?:branches|commits|files)(?:\/|$)/u,
];
// Another program's arguments, joined, that read as a merge or push.
const OPAQUE_MERGE_PATTERN =
  /\b(?:git\b.*\b(?:push|merge|pull|send-pack)|glab\b.*\b(?:merge|accept)|gh\b.*\bmerge)\b|\/merge_requests\/[^/\s]+\/merge\b|\/merge_trains\/|\/pulls\/\d+\/merge\b|\/merges\b|\/git\/refs\b|mergeRequestAccept|mergePullRequest/u;

// Options that take the next argument as their value.
const GIT_VALUE_OPTIONS = new Set([
  "-C",
  "-c",
  "--config-env",
  "--git-dir",
  "--namespace",
  "--super-prefix",
  "--work-tree",
]);
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
const PULL_VALUE_OPTIONS = new Set([
  "-X",
  "-j",
  "-o",
  "-s",
  "--deepen",
  "--depth",
  "--jobs",
  "--negotiation-tip",
  "--refmap",
  "--server-option",
  "--shallow-exclude",
  "--shallow-since",
  "--strategy",
  "--strategy-option",
  "--upload-pack",
]);
const API_FIELD_OPTIONS = ["-F", "-f", "--field", "--raw-field"];

const runGit = (context: GitContext, args: string[]) =>
  spawnSync({
    cmd: ["git", ...context.global, ...args],
    cwd: context.checkout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

const gitText = (context: GitContext, args: string[]): string | null => {
  const result = runGit(context, args);
  return result.success ? result.stdout.toString().trim() : null;
};

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

// How many times any of `names` appears: alone, as `name=value`, or, for a
// short option, with its value attached.
const occurrences = (args: string[], names: string[]): number =>
  args.filter((arg) =>
    names.some(
      (name) =>
        arg === name ||
        arg.startsWith(`${name}=`) ||
        (name.length === 2 && arg.startsWith(name))
    )
  ).length;

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

const currentBranch = (context: GitContext): string | null =>
  gitText(context, ["symbolic-ref", "--quiet", "--short", "HEAD"]);

const targetBranch = (context: GitContext): string =>
  gitText(context, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ])
    ?.split("/")
    .slice(1)
    .join("/") || DEFAULT_TARGET;

// The guard's own --dry-run, --porcelain, and --no-quiet go last, so they
// override any earlier negation (--no-dry-run, --no-porcelain, -q); a push
// whose last argument is an option is refused, because that option could
// take the guard's first flag as its value.
const gitPush = (context: GitContext, args: string[]): Gate => {
  if (args.some((arg) => arg === "--" || arg === "--end-of-options")) {
    return refuse("a git push with -- or --end-of-options is not inspected");
  }
  if ((args.at(-1) ?? "").startsWith("-")) {
    return refuse(
      "a git push that ends with an option is not inspected; put options before the remote"
    );
  }
  const target = `${HEADS_PREFIX}${targetBranch(context)}`;
  const dryRun = runGit(context, [
    "push",
    ...args,
    "--dry-run",
    "--porcelain",
    "--no-quiet",
  ]);
  const output = dryRun.stdout.toString().split("\n");
  if (!(dryRun.success && output.includes("Done"))) {
    const [reason = "it reported no result"] = dryRun.stderr
      .toString()
      .trim()
      .split("\n");
    return refuse(
      `git push --dry-run failed, so the guard cannot tell what the push updates: ${reason}`
    );
  }
  const revisions: string[] = [];
  for (const line of output) {
    const [, flag = "", refs = ""] = PORCELAIN_LINE.exec(line) ?? [];
    const split = refs.lastIndexOf(":");
    const destination = refs.slice(split + 1);
    if (split === -1 || destination !== target || "=!".includes(flag)) {
      continue;
    }
    if (flag === "-") {
      return refuse(`git push would delete ${target}`);
    }
    revisions.push(refs.slice(0, split));
  }
  return revisions.length > 0
    ? requireReceipts(context, `git push to ${target}`, revisions)
    : ALLOW;
};

const gitMerge = (context: GitContext, args: string[]): Gate => {
  const target = targetBranch(context);
  if (
    currentBranch(context) !== target ||
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
  return requireReceipts(context, `git merge into ${target}`, revisions);
};

// Pulling the upstream only syncs; pulling a named branch merges it.
const gitPull = (context: GitContext, args: string[]): Gate => {
  const target = targetBranch(context);
  return currentBranch(context) === target &&
    positionals(args, PULL_VALUE_OPTIONS).length > 1
    ? refuse(
        `git pull of a named branch merges it into ${target}; fetch it and run git merge instead`
      )
    : ALLOW;
};

const git = (checkout: string, args: string[]): Gate => {
  let index = 0;
  while ((args[index] ?? "").startsWith("-")) {
    index += GIT_VALUE_OPTIONS.has(args[index] ?? "") ? 2 : 1;
  }
  const context = { checkout, global: args.slice(0, index) };
  const subcommand = args[index] ?? "";
  const rest = args.slice(index + 1);
  switch (subcommand) {
    case "push": {
      return gitPush(context, rest);
    }
    case "merge": {
      return gitMerge(context, rest);
    }
    case "pull": {
      return gitPull(context, rest);
    }
    case "http-push":
    case "send-pack": {
      return refuse(`git ${subcommand} is not inspected; use git push`);
    }
    case "subtree": {
      return rest.some((arg) => MERGING_WORD.test(arg))
        ? refuse("git subtree push, pull, and merge are not inspected")
        : ALLOW;
    }
    default: {
      const alias = gitText(context, [
        "config",
        "--get",
        `alias.${subcommand}`,
      ]);
      return alias !== null && MERGING_WORD.test(alias)
        ? refuse(
            `git ${subcommand} is an alias for "${alias}"; run the command directly`
          )
        : ALLOW;
    }
  }
};

// The HTTP method of a `glab api` or `gh api` call: explicit, or POST when
// it sends fields or an input body, as both CLIs default.
const apiMethod = (args: string[]): string => {
  const attached = args.find((arg) => arg.startsWith("-X") && arg.length > 2);
  const method =
    optionValue(args, "--method") ??
    optionValue(args, "-X") ??
    attached?.slice(2);
  if (method !== undefined) {
    return method.toUpperCase();
  }
  return fieldValues(args).length > 0 ||
    optionValue(args, "--input") !== undefined
    ? "POST"
    : "GET";
};

const READ_METHODS = new Set(["GET", "HEAD"]);
const endpointPath = (arg: string): string => arg.split("?")[0] ?? "";

// A provider API call to a merge or ref-writing endpoint: reads pass, a
// merge must pin one head with a receipt, and a direct ref write is refused.
// The CLI keeps the last of a repeated option, so a repeated method or sha is
// refused rather than modeled.
const apiMerge = (
  context: GitContext,
  args: string[],
  endpoint: string,
  label: string
): Gate => {
  const query = new URLSearchParams(endpoint.split("?")[1] ?? "");
  const shas = fieldValues(args)
    .filter((field) => field.startsWith("sha="))
    .map((field) => field.slice(4));
  if (query.has("sha")) {
    shas.push(query.get("sha") ?? "");
  }
  if (occurrences(args, ["-X", "--method"]) > 1 || shas.length > 1) {
    return refuse(
      `a ${label} API merge that repeats its method or sha is not inspected`
    );
  }
  if (READ_METHODS.has(apiMethod(args))) {
    return ALLOW;
  }
  if (
    !API_MERGE_PATHS.some((pattern) => pattern.test(endpointPath(endpoint)))
  ) {
    return refuse(
      `${endpoint} writes refs, commits, or files directly; push through git instead`
    );
  }
  const [sha] = shas;
  return sha
    ? requireReceipts(context, `a ${label} API merge`, [sha])
    : refuse(
        `a ${label} API merge must pin the head it merges with -f sha=<head>`
      );
};

// A provider merge, wherever its subcommand sits among the flags: a mutating
// API call to a merge endpoint pinned with `-f sha=<head>` or a `sha` query
// parameter, or the CLI merge pinned with its head option. A mutating API
// call that writes refs, commits, or files directly is refused.
const providerMerge = (
  checkout: string,
  args: string[],
  provider: {
    headOption: string;
    label: string;
    merge: string[];
    noun: string;
  }
): Gate => {
  const context = { checkout, global: [] };
  if (
    args.includes("graphql") &&
    args.some((arg) => GRAPHQL_REF_WRITE.test(arg))
  ) {
    return refuse(
      `a ${provider.label} GraphQL call that merges or writes refs pins no head; use the REST merge with -f sha=<head>`
    );
  }
  const endpoint = args.find((arg) =>
    [...API_MERGE_PATHS, ...API_REF_WRITE_PATHS].some((pattern) =>
      pattern.test(endpointPath(arg))
    )
  );
  if (endpoint !== undefined) {
    return apiMerge(context, args, endpoint, provider.label);
  }
  const noun = args.indexOf(provider.noun);
  if (
    noun !== -1 &&
    args.slice(noun + 1).some((arg) => provider.merge.includes(arg))
  ) {
    const sha = optionValue(args, provider.headOption);
    const label = `${provider.label} ${provider.noun} merge`;
    if (occurrences(args, [provider.headOption]) > 1) {
      return refuse(`${label} repeats ${provider.headOption}`);
    }
    return sha
      ? requireReceipts(context, label, [sha])
      : refuse(
          `${label} must pin the head it merges with ${provider.headOption} <head>`
        );
  }
  return ALLOW;
};

/** Decides whether the exec command is gated, and on which revisions. */
export const gateFor = (checkout: string, argv: string[]): Gate => {
  let command = argv;
  // `env NAME=value command` still runs the command as direct argv, but an
  // assignment that redirects Git (GIT_DIR, GIT_CONFIG_*) is not inspected.
  if (basename(command[0] ?? "") === "env") {
    const rest = command.slice(1);
    const start = rest.findIndex((arg) => !ENV_ASSIGNMENT_PATTERN.test(arg));
    const assignments = start === -1 ? rest : rest.slice(0, start);
    if (assignments.some((arg) => arg.startsWith("GIT_"))) {
      return refuse("env assignments to GIT_ variables are not inspected");
    }
    if (start !== -1 && !(rest[start] ?? "").startsWith("-")) {
      command = rest.slice(start);
    }
  }
  const [program = "", ...args] = command;
  switch (basename(program)) {
    case "git": {
      return git(checkout, args);
    }
    case "glab": {
      return providerMerge(checkout, args, {
        headOption: "--sha",
        label: "GitLab",
        merge: ["accept", "merge"],
        noun: "mr",
      });
    }
    case "gh": {
      return providerMerge(checkout, args, {
        headOption: "--match-head-commit",
        label: "GitHub",
        merge: ["merge"],
        noun: "pr",
      });
    }
    default: {
      return OPAQUE_MERGE_PATTERN.test(args.join(" "))
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
  const common = gitText(gate.context, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  for (const revision of gate.revisions) {
    const head = gitText(gate.context, [
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
