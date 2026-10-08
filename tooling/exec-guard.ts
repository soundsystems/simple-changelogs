#!/usr/bin/env bun

// This repository's Simple Changes `execGuard` (see .simple-changes.json).
// `loop exec` runs `bun tooling/exec-guard.ts <command...>` before the
// command. The repository has no CI or Git hooks, so this guard is its merge
// gate: it refuses a merge-like command unless a passing `bun run check`
// receipt (tooling/check-receipt.ts) exists for the exact head being merged
// or pushed, and exits 0 for every command it does not gate.
//
// Gated:
// - a provider merge: `glab mr merge|accept` pinned with `--sha <head>`,
//   `gh pr merge` pinned with `--match-head-commit <head>`, or a mutating
//   `glab api`/`gh api` call to a merge request's `/merge` or merge-train
//   endpoint or a pull request's `/merge` or `/merge-async`, pinned with one
//   `sha` field or query value. Each command is parsed against its complete
//   flag table, so an option's value never poses as a head, endpoint, or
//   method; an unknown flag, or an option before or between the subcommand
//   words other than `-R`/`--repo`/`--hostname`, is refused. An API call is a read only with
//   one GET or HEAD method, or with no method and no body. A merge that pins
//   no head or repeats it, one whose body comes from a file, a mutating call
//   that writes refs, commits, or files directly, and any GraphQL call but
//   an inline query are refused;
// - `git push`: Git itself reports what the push would update (`git push
//   <args> --dry-run --porcelain --no-quiet`, with the same options and
//   configuration), and every update to the target branch on any remote
//   needs a receipt for the pushed commit. Deleting the target is refused,
//   and so is a push whose dry run fails, one with `--`, and one whose last
//   argument is an option;
// - `git merge` while the target branch is checked out, for each merged
//   revision (MERGE_HEAD for --continue, the upstream with no revision); no
//   `git pull` runs on the target branch;
// - `git send-pack`, `git http-push`, and any `git` subcommand that is not a
//   built-in command (an alias, chained or not, or an external git-*
//   command such as `git subtree`) are refused.
//
// Boundary: the guard reads the exec argv and fails safe: whatever it cannot
// read as one plain value (a repeated method, sha, or head option; an `env`
// assignment to a GIT_ variable; a body from a file) is refused rather than
// modeled, and it inherits the environment the command runs with. Another
// program whose arguments read as a Git or provider merge or push (a shell
// `-c` script, `timeout`, `bunx`) is refused; a merge hidden inside a script
// or package task is not seen, and only commands run through `loop exec` are
// guarded at all. Local branch moves other than `git merge` and `git pull`
// (commit, reset, rebase) are not gated; the push that publishes them is.
// Refs can move between the guard and the command it allowed, and host
// branch protection remains the control for provider API writes the guard
// does not list. A receipt proves the head passed `bun run check`; a merge
// result equals that head only when the head already contains the target
// tip.

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
// GraphQL mutations that merge or move a branch.
const GRAPHQL_REF_WRITE =
  /mutation|merge|updateRefs?\b|createCommitOnBranch|commitCreate|createRef|deleteRef/iu;
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
  // Only a lone --abort or --quit is exempt; Git honors a later negation.
  const stops =
    args.length === 1 && ["--abort", "--quit"].includes(args[0] ?? "");
  if (currentBranch(context) !== target || stops) {
    return ALLOW;
  }
  const named = positionals(args, MERGE_VALUE_OPTIONS);
  let revisions = named.length > 0 ? named : ["@{upstream}"];
  if (args.includes("--continue")) {
    revisions = ["MERGE_HEAD"];
  }
  return requireReceipts(context, `git merge into ${target}`, revisions);
};

// Options and configuration decide what a pull merges, so no pull runs on
// the target branch; fetch and run git merge, which the guard checks.
const gitPull = (context: GitContext): Gate => {
  const target = targetBranch(context);
  return currentBranch(context) === target
    ? refuse(
        `git pull does not run on ${target}; fetch and run git merge, which the guard checks`
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
      return gitPull(context);
    }
    case "http-push":
    case "send-pack": {
      return refuse(`git ${subcommand} is not inspected; use git push`);
    }
    case "": {
      return ALLOW;
    }
    default: {
      // An alias, possibly chained, or an external git-* command can run
      // anything, so only Git's built-in commands pass.
      const builtins = gitText(context, ["--list-cmds=builtins"]);
      return builtins?.split("\n").includes(subcommand)
        ? ALLOW
        : refuse(
            `git ${subcommand} is not a built-in Git command (an alias or external command); run the underlying command directly`
          );
    }
  }
};

// A provider command's flags, parsed against its complete flag table so an
// option's value can never pose as an option, endpoint, or method. A flag
// outside the table is unknown, and the call is refused rather than guessed.
interface FlagTable {
  booleans: ReadonlySet<string>;
  values: ReadonlySet<string>;
}

interface ParsedFlags {
  positionals: string[];
  unknown: string[];
  values: Map<string, string[]>;
}

const table = (values: string[], booleans: string[]): FlagTable => ({
  booleans: new Set([...booleans, "-h", "--help"]),
  values: new Set(values),
});

// `gh api` and `glab api` flags together; the endpoints of the two differ.
const API_FLAGS = table(
  [
    "-F",
    "-H",
    "-R",
    "-X",
    "-f",
    "-p",
    "-q",
    "-t",
    "--cache",
    "--field",
    "--form",
    "--header",
    "--hostname",
    "--input",
    "--jq",
    "--method",
    "--output",
    "--preview",
    "--raw-field",
    "--repo",
    "--template",
  ],
  ["-i", "--include", "--paginate", "--silent", "--slurp", "--verbose"]
);
const GH_PR_MERGE_FLAGS = table(
  [
    "-A",
    "-F",
    "-R",
    "-b",
    "-t",
    "--author-email",
    "--body",
    "--body-file",
    "--match-head-commit",
    "--repo",
    "--subject",
  ],
  [
    "-d",
    "-m",
    "-r",
    "-s",
    "--admin",
    "--auto",
    "--delete-branch",
    "--disable-auto",
    "--merge",
    "--rebase",
    "--squash",
  ]
);
const GLAB_MR_MERGE_FLAGS = table(
  ["-R", "-m", "--message", "--repo", "--sha", "--squash-message"],
  [
    "-d",
    "-r",
    "-s",
    "-y",
    "--auto-merge",
    "--rebase",
    "--remove-source-branch",
    "--squash",
    "--when-pipeline-succeeds",
    "--yes",
  ]
);
// Options a provider CLI accepts before its subcommand.
const PROVIDER_GLOBAL_VALUES = new Set(["-R", "--hostname", "--repo"]);
const FIELD_FLAGS = ["-F", "-f", "--field", "--form", "--raw-field"];
const READ_METHODS = new Set(["GET", "HEAD"]);
const LEADING_EQUALS = /^=/u;
// Any spelling of the GraphQL endpoint: `graphql`, `/graphql`, or a URL.
const GRAPHQL_ENDPOINT = /graphql/iu;

// An option token's name and, for `--name=value`, `-Xvalue`, or `-X=value`,
// its attached value.
const optionToken = (
  arg: string
): { attached: string | null; long: boolean; name: string } => {
  if (arg.startsWith("--")) {
    const [name = arg, ...rest] = arg.split("=");
    return {
      attached: rest.length > 0 ? rest.join("=") : null,
      long: true,
      name,
    };
  }
  return {
    attached: arg.length > 2 ? arg.slice(2).replace(LEADING_EQUALS, "") : null,
    long: false,
    name: arg.slice(0, 2),
  };
};

const parseFlags = (args: string[], flags: FlagTable): ParsedFlags => {
  const parsed: ParsedFlags = {
    positionals: [],
    unknown: [],
    values: new Map(),
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") {
      parsed.positionals.push(...args.slice(index + 1));
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      parsed.positionals.push(arg);
      continue;
    }
    const { attached, long, name } = optionToken(arg);
    if (flags.values.has(name)) {
      const value = attached ?? args[index + 1] ?? "";
      parsed.values.set(name, [...(parsed.values.get(name) ?? []), value]);
      index += attached === null ? 1 : 0;
    } else if (!(flags.booleans.has(name) && (long || attached === null))) {
      parsed.unknown.push(arg);
    }
  }
  return parsed;
};

const valuesOf = (parsed: ParsedFlags, names: string[]): string[] =>
  names.flatMap((name) => parsed.values.get(name) ?? []);

// A read: one GET or HEAD method, or no method and no request body.
const isRead = (parsed: ParsedFlags): boolean => {
  const methods = valuesOf(parsed, ["-X", "--method"]);
  if (methods.length > 0) {
    return (
      methods.length === 1 && READ_METHODS.has((methods[0] ?? "").toUpperCase())
    );
  }
  return valuesOf(parsed, [...FIELD_FLAGS, "--input"]).length === 0;
};

// A body the guard cannot read: an input file or a field read from a file.
const hiddenBody = (parsed: ParsedFlags): boolean =>
  valuesOf(parsed, ["--input"]).length > 0 ||
  valuesOf(parsed, FIELD_FLAGS).some((field) => field.includes("=@"));

const endpointPath = (endpoint: string): string => endpoint.split("?")[0] ?? "";

// A merge or ref-writing endpoint: reads pass, a merge must pin exactly one
// visible head with a receipt, and a direct ref write is refused.
const apiCall = (
  context: GitContext,
  parsed: ParsedFlags,
  label: string
): Gate => {
  const [endpoint = "", ...extra] = parsed.positionals;
  if (parsed.unknown.length > 0 || extra.length > 0) {
    return refuse(
      `a ${label} API call with ${[...parsed.unknown, ...extra].join(" ")} is not inspected`
    );
  }
  const fields = valuesOf(parsed, FIELD_FLAGS);
  if (GRAPHQL_ENDPOINT.test(endpointPath(endpoint))) {
    return hiddenBody(parsed) ||
      fields.some((field) => GRAPHQL_REF_WRITE.test(field))
      ? refuse(
          `a ${label} GraphQL call runs only as an inline query; merge through the REST merge with -f sha=<head>`
        )
      : ALLOW;
  }
  const path = endpointPath(endpoint);
  const merge = API_MERGE_PATHS.some((pattern) => pattern.test(path));
  if (
    !(merge || API_REF_WRITE_PATHS.some((pattern) => pattern.test(path))) ||
    isRead(parsed)
  ) {
    return ALLOW;
  }
  if (!merge) {
    return refuse(
      `${endpoint} writes refs, commits, or files directly; push through git instead`
    );
  }
  if (hiddenBody(parsed)) {
    return refuse(
      `a ${label} API merge with a body read from a file is not inspected`
    );
  }
  const shas = [
    ...fields
      .filter((field) => field.startsWith("sha="))
      .map((field) => field.slice(4)),
    ...new URLSearchParams(endpoint.split("?")[1] ?? "").getAll("sha"),
  ];
  if (shas.length > 1) {
    return refuse(`a ${label} API merge that repeats its sha is not inspected`);
  }
  const [sha] = shas;
  return sha
    ? requireReceipts(context, `a ${label} API merge`, [sha])
    : refuse(
        `a ${label} API merge must pin the head it merges with -f sha=<head>`
      );
};

// A provider command, read as `<cli> [-R repo] <noun> <verb> ...`: an API
// call is judged by its endpoint and method, and the CLI merge must pin one
// head with its head option. Any other option before the subcommand is
// refused, because it could hide which subcommand runs.
const providerCommand = (
  checkout: string,
  args: string[],
  provider: {
    headOption: string;
    label: string;
    merge: string[];
    mergeFlags: FlagTable;
    noun: string;
  }
): Gate => {
  // The subcommand words, `<noun> <verb>` or `api`, with only -R, --repo, or
  // --hostname allowed before or between them: any other option there could
  // hide which subcommand runs.
  const words: string[] = [];
  let index = 0;
  while (index < args.length && words.length < 2 && words[0] !== "api") {
    const arg = args[index] ?? "";
    if (!arg.startsWith("-")) {
      words.push(arg);
      index += 1;
    } else if (PROVIDER_GLOBAL_VALUES.has(arg)) {
      index += 2;
    } else if (
      [...PROVIDER_GLOBAL_VALUES].some(
        (name) =>
          arg.startsWith(`${name}=`) || (name === "-R" && arg.startsWith("-R"))
      )
    ) {
      index += 1;
    } else {
      return refuse(
        `${arg} before the ${provider.label} subcommand is not inspected`
      );
    }
  }
  const context = { checkout, global: [] };
  const [noun = "", verb = ""] = words;
  if (noun === "api") {
    return apiCall(
      context,
      parseFlags(args.slice(index), API_FLAGS),
      provider.label
    );
  }
  if (noun !== provider.noun || !provider.merge.includes(verb)) {
    return ALLOW;
  }
  const label = `${provider.label} ${noun} merge`;
  const parsed = parseFlags(args.slice(index), provider.mergeFlags);
  if (parsed.unknown.length > 0) {
    return refuse(`${label} with ${parsed.unknown.join(" ")} is not inspected`);
  }
  const heads = valuesOf(parsed, [provider.headOption]);
  if (heads.length > 1) {
    return refuse(`${label} repeats ${provider.headOption}`);
  }
  const [sha] = heads;
  return sha
    ? requireReceipts(context, label, [sha])
    : refuse(
        `${label} must pin the head it merges with ${provider.headOption} <head>`
      );
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
      return providerCommand(checkout, args, {
        headOption: "--sha",
        label: "GitLab",
        merge: ["accept", "merge"],
        mergeFlags: GLAB_MR_MERGE_FLAGS,
        noun: "mr",
      });
    }
    case "gh": {
      return providerCommand(checkout, args, {
        headOption: "--match-head-commit",
        label: "GitHub",
        merge: ["merge"],
        mergeFlags: GH_PR_MERGE_FLAGS,
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
