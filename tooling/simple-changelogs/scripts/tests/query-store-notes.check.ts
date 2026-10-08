import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "bun";
import { storeNoteLength } from "../query.ts";

const queryPath = new URL("../query.ts", import.meta.url).pathname;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const ASTRAL = "\u{1F680}";
const COMBINED = "é";

const runCheck = async (
  repo: string,
  json = false
): Promise<{ exitCode: number; stdout: string }> => {
  const child = spawn({
    cmd: [
      process.execPath,
      queryPath,
      "check",
      "--log",
      "customer",
      "--repo",
      repo,
      ...(json ? ["--json"] : []),
    ],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
  ]);
  return { exitCode, stdout };
};

const fixture = async (files: Record<string, string>): Promise<string> => {
  const repo = await mkdtemp(join(tmpdir(), "query-store-notes-"));
  temporaryDirectories.push(repo);
  await Promise.all(
    Object.entries({
      "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n- Pending\n",
      ...files,
    }).map(async ([path, text]) => {
      await mkdir(dirname(join(repo, path)), { recursive: true });
      await writeFile(join(repo, path), text);
    })
  );
  return repo;
};

describe("store-note length", () => {
  test("counts code points, not UTF-16 code units", () => {
    expect(ASTRAL.repeat(500)).toHaveLength(1000);
    expect(storeNoteLength(ASTRAL.repeat(500))).toBe(500);
    // A combining mark is its own code point, the stricter count.
    expect(storeNoteLength(COMBINED.repeat(250))).toBe(500);
    expect(storeNoteLength(COMBINED.normalize("NFC").repeat(250))).toBe(250);
    // A flag is two regional-indicator code points.
    expect(storeNoteLength("\u{1F1FA}\u{1F1F8}")).toBe(2);
  });

  test("ignores a byte order mark and trailing line breaks, not interior ones", () => {
    expect(storeNoteLength("﻿Fixes\n")).toBe(5);
    expect(storeNoteLength("Fixes\r\n\r\n")).toBe(5);
    expect(storeNoteLength("One\nTwo\n")).toBe(7);
    expect(storeNoteLength("  Lead\n")).toBe(6);
  });
});

describe("query check store notes", () => {
  test("holds App Store and Google Play notes to their per-locale limits", async () => {
    const repo = await fixture({
      ".gitignore": "ignored/\n",
      "app/src/main/play/release-notes/en-US/default.txt": "x".repeat(501),
      "app/src/main/play/release-notes/fr-FR/production.txt": `${"y".repeat(500)}\n`,
      "fastlane/metadata/android/en-US/changelogs/120.txt": ASTRAL.repeat(500),
      "fastlane/metadata/android/ja-JP/changelogs/default.txt":
        COMBINED.repeat(251),
      "fastlane/metadata/de-DE/release_notes.txt": "z".repeat(4001),
      "fastlane/metadata/en-US/description.txt": "d".repeat(5000),
      "fastlane/metadata/en-US/release_notes.txt": ASTRAL.repeat(4000),
      "ignored/fastlane/metadata/en-US/release_notes.txt": "i".repeat(5000),
    });
    execFileSync("git", ["-C", repo, "init", "-q"]);
    const [text, json] = await Promise.all([
      runCheck(repo),
      runCheck(repo, true),
    ]);
    expect(text.exitCode).toBe(1);
    expect(text.stdout).toContain(
      "Store notes: 6 checked, 3 over their limit."
    );
    expect(text.stdout).toContain(
      "Google Play release notes allows 500 characters per locale; this note has 501"
    );
    expect(text.stdout).toContain(
      "Google Play release notes allows 500 characters per locale; this note has 502"
    );
    expect(text.stdout).toContain(
      "App Store What's New allows 4000 characters per locale; this note has 4001"
    );
    // Notes within their limits collapse into the summary line.
    expect(text.stdout).not.toContain("changelogs/120.txt");
    const report = JSON.parse(json.stdout) as {
      files: {
        diagnostics: string[];
        path: string;
        storeNote?: { characters: number; limit: number; store: string };
      }[];
      problems: number;
    };
    const notes = report.files.filter((file) => file.storeNote);
    expect(
      notes.map((file) => [
        file.path.slice(repo.length + 1),
        file.storeNote?.characters,
        file.storeNote?.limit,
      ])
    ).toEqual([
      ["app/src/main/play/release-notes/en-US/default.txt", 501, 500],
      ["app/src/main/play/release-notes/fr-FR/production.txt", 500, 500],
      ["fastlane/metadata/android/en-US/changelogs/120.txt", 500, 500],
      ["fastlane/metadata/android/ja-JP/changelogs/default.txt", 502, 500],
      ["fastlane/metadata/de-DE/release_notes.txt", 4001, 4000],
      ["fastlane/metadata/en-US/release_notes.txt", 4000, 4000],
    ]);
    expect(report.problems).toBe(3);
  });

  test("scans a directory outside Git, skipping node_modules", async () => {
    const repo = await fixture({
      "fastlane/metadata/android/en-US/changelogs/7.txt": "n".repeat(600),
      "node_modules/pkg/fastlane/metadata/en-US/release_notes.txt": "m".repeat(
        5000
      ),
    });
    const { exitCode, stdout } = await runCheck(repo);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("Store notes: 1 checked, 1 over their limit.");
    expect(stdout).toContain("this note has 600");
  });

  test("adds nothing when a repository has no store notes", async () => {
    const repo = await fixture({});
    const { exitCode, stdout } = await runCheck(repo);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Store notes");
  });
});
