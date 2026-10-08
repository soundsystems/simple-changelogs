#!/usr/bin/env bun

// `bun run check:receipt`: runs `bun run check` on this clean checkout and,
// only when it exits 0, records a check receipt for the exact HEAD commit.
// tooling/exec-guard.ts refuses a merge or a push to the target branch whose
// head has no receipt.
//
// A clean checkout has no changed, untracked, assume-unchanged, or
// skip-worktree path.
//
// Receipt format (schemaVersion 1), one JSON file per commit at
// `<git common dir>/check-receipts/<40-hex HEAD>.json`, so every worktree of
// the repository shares it and Git never tracks it:
//
//   { "command": "bun run check", "exitCode": 0,
//     "finishedAt": "<UTC ISO 8601>", "head": "<40-hex HEAD>",
//     "schemaVersion": 1 }
//
// A receipt exists only for a passing run, so exitCode is always 0. A reader
// accepts it only when every field matches and `head` equals the file name.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "bun";

export const RECEIPT_COMMAND = "bun run check";
const RECEIPT_DIRECTORY = "check-receipts";
const HEAD_PATTERN = /^[0-9a-f]{40}$/u;
const MILLISECONDS_PATTERN = /\.\d{3}Z$/u;
const HIDDEN_TAG = /^(?:[a-z]|S) /u;

export interface CheckReceipt {
  command: typeof RECEIPT_COMMAND;
  exitCode: 0;
  finishedAt: string;
  head: string;
  schemaVersion: 1;
}

/** Runs Git in `cwd`; null when it fails. */
export const gitOutput = (cwd: string, args: string[]): string | null => {
  const result = spawnSync({
    cmd: ["git", "-C", cwd, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  return result.success ? result.stdout.toString().trim() : null;
};

/** The shared Git directory of every worktree of the repository at `cwd`. */
export const commonDirectory = (cwd: string): string | null =>
  gitOutput(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);

export const receiptPath = (common: string, head: string): string =>
  join(common, RECEIPT_DIRECTORY, `${head}.json`);

/** True when a valid passing receipt names exactly `head`. */
export const hasPassingReceipt = (common: string, head: string): boolean => {
  if (!HEAD_PATTERN.test(head)) {
    return false;
  }
  try {
    const receipt = JSON.parse(
      readFileSync(receiptPath(common, head), "utf8")
    ) as Partial<CheckReceipt>;
    return (
      receipt.schemaVersion === 1 &&
      receipt.head === head &&
      receipt.command === RECEIPT_COMMAND &&
      receipt.exitCode === 0 &&
      typeof receipt.finishedAt === "string"
    );
  } catch {
    return false;
  }
};

/** Writes the receipt atomically, so a reader never sees a partial file. */
export const writeReceipt = (common: string, head: string): string => {
  const receipt: CheckReceipt = {
    command: RECEIPT_COMMAND,
    exitCode: 0,
    finishedAt: new Date().toISOString().replace(MILLISECONDS_PATTERN, "Z"),
    head,
    schemaVersion: 1,
  };
  const path = receiptPath(common, head);
  mkdirSync(join(common, RECEIPT_DIRECTORY), { recursive: true });
  const partial = `${path}.${process.pid}.tmp`;
  writeFileSync(partial, `${JSON.stringify(receipt, null, 2)}\n`);
  renameSync(partial, path);
  return path;
};

// Changed or untracked paths, plus tracked paths marked assume-unchanged
// (a lowercase `git ls-files -v` tag) or skip-worktree (`S`), whose edits
// `git status` would not show.
const dirtyPaths = (root: string): string[] | null => {
  const status = gitOutput(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const listed = gitOutput(root, ["ls-files", "-v"]);
  if (status === null || listed === null) {
    return null;
  }
  const hidden = listed
    .split("\n")
    .filter((line) => HIDDEN_TAG.test(line))
    .map((line) => `hidden from git status: ${line.slice(2)}`);
  return [...status.split("\n").filter(Boolean), ...hidden];
};

// Install from the lockfile, then run the check, exactly as committed.
const DEFAULT_COMMANDS = [
  ["bun", "install", "--frozen-lockfile"],
  ["bun", "run", "check"],
];

/**
 * Runs the check commands in a clean checkout and records a receipt for its
 * HEAD when every command exits 0. Returns the exit status. `commands` lets
 * tests stand in for the real check.
 */
export const runCheckReceipt = (
  root: string,
  commands: string[][] = DEFAULT_COMMANDS,
  log: (line: string) => void = (line) => process.stderr.write(`${line}\n`)
): number => {
  const head = gitOutput(root, ["rev-parse", "HEAD"]);
  const common = commonDirectory(root);
  const dirty = dirtyPaths(root);
  if (head === null || common === null || dirty === null) {
    log(`check:receipt: ${root} is not a Git checkout with a commit`);
    return 1;
  }
  if (dirty.length > 0) {
    log(
      `check:receipt: commit or stash every change first; a receipt covers only a clean checkout:\n${dirty.slice(0, 10).join("\n")}`
    );
    return 1;
  }
  for (const cmd of commands) {
    const result = spawnSync({
      cmd,
      cwd: root,
      stderr: "inherit",
      stdin: "ignore",
      stdout: "inherit",
    });
    if (!result.success) {
      log(
        `check:receipt: ${cmd.join(" ")} exited ${result.exitCode ?? result.signalCode}; no receipt written`
      );
      return result.exitCode || 1;
    }
  }
  const after = gitOutput(root, ["rev-parse", "HEAD"]);
  const dirtyAfter = dirtyPaths(root);
  if (after !== head || dirtyAfter === null || dirtyAfter.length > 0) {
    log(
      `check:receipt: the checkout changed while ${RECEIPT_COMMAND} ran; no receipt written`
    );
    return 1;
  }
  log(`check:receipt: wrote ${writeReceipt(common, head)}`);
  return 0;
};

if (import.meta.main) {
  process.exitCode = runCheckReceipt(resolve(import.meta.dir, ".."));
}
