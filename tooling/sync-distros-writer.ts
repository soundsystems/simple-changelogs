#!/usr/bin/env bun

import { isAbsolute } from "node:path";
import { stdin } from "bun";
import {
  type SyncedFile,
  type WritePayload,
  writeHeldCopy,
} from "./sync-distros.ts";

// The writer process of `bun run sync-distros`: reads the absolute repository
// root and the copies to write as JSON on stdin, then writes them one at a
// time with the held walk, which moves this process's working directory and
// so never runs in the process that started it. A refusal stops the run at
// that copy, nothing after it is written, its message goes to stderr, and the
// exit code is 1; the parent relays the message. A payload that is not what
// the parent sends is refused the same way.

const isCopy = (value: unknown): value is SyncedFile => {
  const copy = value as Partial<SyncedFile> | null;
  return (
    typeof copy === "object" &&
    copy !== null &&
    typeof copy.expected === "string" &&
    typeof copy.mode === "number" &&
    typeof copy.source === "string" &&
    typeof copy.target === "string"
  );
};

const parsePayload = (text: string): WritePayload => {
  const payload = JSON.parse(text) as {
    files?: unknown;
    root?: unknown;
  } | null;
  const root = payload?.root;
  const files = payload?.files;
  if (typeof root !== "string" || !isAbsolute(root)) {
    throw new Error("The sync writer needs an absolute repository root");
  }
  if (!(Array.isArray(files) && files.every(isCopy))) {
    throw new Error("The sync writer needs a list of copies to write");
  }
  return { files, root };
};

if (import.meta.main) {
  try {
    const { files, root } = parsePayload(await stdin.text());
    for (const file of files) {
      writeHeldCopy(root, file);
    }
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
