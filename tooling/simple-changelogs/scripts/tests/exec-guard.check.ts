import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import {
  commonDirectory,
  hasPassingReceipt,
  receiptPath,
  runCheckReceipt,
  writeReceipt,
} from "../../../check-receipt.ts";
import { verdict } from "../../../exec-guard.ts";

const GUARD = join(import.meta.dir, "..", "..", "..", "exec-guard.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const gitIn =
  (cwd: string) =>
  (...args: string[]): string =>
    execFileSync(
      "git",
      [
        "-C",
        cwd,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        ...args,
      ],
      { encoding: "utf8" }
    ).trim();

// A clone of a bare origin whose HEAD is main, plus a feature branch.
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "exec-guard-"));
  temporaryDirectories.push(root);
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  await mkdir(repo);
  const git = gitIn(repo);
  git("init", "-q", "-b", "main");
  await writeFile(join(repo, "README.md"), "one\n");
  git("add", "-A");
  git("commit", "-qm", "one");
  git("remote", "add", "origin", origin);
  git("push", "-q", "-u", "origin", "main");
  git("remote", "set-head", "origin", "main");
  git("checkout", "-qb", "feature");
  await writeFile(join(repo, "feature.txt"), "feature\n");
  git("add", "-A");
  git("commit", "-qm", "feature");
  git("checkout", "-q", "main");
  const common = commonDirectory(repo) ?? "";
  const sha = (revision: string) => git("rev-parse", revision);
  const pass = (revision: string) => writeReceipt(common, sha(revision));
  return { common, git, pass, repo, root, sha };
};

const allowed = (repo: string, argv: string[]) => {
  const reason = verdict(repo, argv);
  expect(reason).toBeNull();
};
const refused = (repo: string, argv: string[], fragment: string) =>
  expect(verdict(repo, argv) ?? "").toContain(fragment);

describe("check receipts", () => {
  test("record a passing run on a clean checkout for its exact HEAD", async () => {
    const { common, git, repo, root, sha } = await fixture();
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const ok = [process.execPath, "-e", "process.exit(0)"];
    expect(runCheckReceipt(repo, [ok], log)).toBe(0);
    const receipt = JSON.parse(
      await readFile(receiptPath(common, sha("HEAD")), "utf8")
    );
    expect(receipt).toMatchObject({
      command: "bun run check",
      exitCode: 0,
      head: sha("HEAD"),
      schemaVersion: 1,
    });
    expect(hasPassingReceipt(common, sha("HEAD"))).toBe(true);

    // A linked worktree writes into the shared common directory.
    const linked = join(root, "linked");
    git("worktree", "add", "-q", linked, "feature");
    expect(runCheckReceipt(linked, [ok], log)).toBe(0);
    expect(hasPassingReceipt(common, sha("feature"))).toBe(true);
    expect(lines.at(-1)).toContain("check-receipts");
  });

  test("write nothing for a dirty checkout, a failing check, or a checkout that changes", async () => {
    const { common, repo, sha } = await fixture();
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const head = sha("HEAD");
    await writeFile(join(repo, "scratch.txt"), "dirty\n");
    expect(
      runCheckReceipt(repo, [[process.execPath, "-e", "process.exit(0)"]], log)
    ).toBe(1);
    expect(lines.at(-1)).toContain("commit or stash");
    await rm(join(repo, "scratch.txt"));
    expect(
      runCheckReceipt(repo, [[process.execPath, "-e", "process.exit(3)"]], log)
    ).toBe(3);
    expect(
      runCheckReceipt(
        repo,
        [
          [
            process.execPath,
            "-e",
            "require('node:fs').writeFileSync('made.txt', 'x')",
          ],
        ],
        log
      )
    ).toBe(1);
    expect(lines.at(-1)).toContain("changed while");
    expect(existsSync(receiptPath(common, head))).toBe(false);
  });

  test("accept only a well-formed receipt naming its own head", async () => {
    const { common, sha } = await fixture();
    const head = sha("HEAD");
    const path = writeReceipt(common, head);
    const receipt = JSON.parse(await readFile(path, "utf8"));
    for (const broken of [
      { ...receipt, exitCode: 1 },
      { ...receipt, head: sha("feature") },
      { ...receipt, command: "bun run test" },
      { ...receipt, schemaVersion: 2 },
    ]) {
      writeFileSync(path, JSON.stringify(broken));
      expect(hasPassingReceipt(common, head)).toBe(false);
    }
    await writeFile(path, "{");
    expect(hasPassingReceipt(common, head)).toBe(false);
    expect(hasPassingReceipt(common, "HEAD")).toBe(false);
  });
});

describe("exec guard", () => {
  test("lets every command it does not gate run", async () => {
    const { repo } = await fixture();
    for (const argv of [
      ["bun", "run", "check"],
      ["git", "status"],
      ["git", "fetch", "origin"],
      ["git", "push", "--dry-run", "origin", "main"],
      ["git", "push", "origin", "feature"],
      ["git", "push", "origin", "refs/tags/v1.0.0"],
      ["glab", "mr", "view", "7"],
      ["glab", "api", "projects/83469495/merge_requests/7"],
      ["gh", "pr", "view", "3"],
      ["sh", "-c", "echo merged.json"],
      ["env", "A=1", "git", "status"],
    ]) {
      allowed(repo, argv);
    }
  });

  test("gates provider merges on the pinned head's receipt", async () => {
    const { pass, repo, sha } = await fixture();
    const head = sha("feature");
    const glabApi = [
      "glab",
      "api",
      "projects/83469495/merge_requests/7/merge",
      "-X",
      "PUT",
      "-f",
      `sha=${head}`,
    ];
    refused(repo, glabApi, "no passing bun run check receipt");
    refused(
      repo,
      ["glab", "api", "-X", "PUT", "projects/83469495/merge_requests/7/merge"],
      "must pin the head"
    );
    refused(repo, ["glab", "mr", "merge", "7"], "--sha <head>");
    refused(repo, ["gh", "pr", "merge", "3"], "--match-head-commit <head>");
    refused(
      repo,
      [
        "glab",
        "api",
        "projects/x/merge_requests/7/merge",
        "-f",
        "sha=deadbeef",
      ],
      "does not resolve"
    );
    pass("feature");
    allowed(repo, glabApi);
    allowed(repo, [
      "glab",
      "api",
      "--method=PUT",
      `projects/soundsystems%2Fsimple-changelogs/merge_requests/7/merge?sha=${head}`,
    ]);
    allowed(repo, [
      "glab",
      "api",
      `--raw-field=sha=${head}`,
      "/projects/1/merge_requests/7/merge",
    ]);
    allowed(repo, ["glab", "mr", "merge", "7", `--sha=${head}`]);
    allowed(repo, ["gh", "pr", "merge", "3", "--match-head-commit", head]);
    allowed(repo, [
      "gh",
      "api",
      "repos/o/r/pulls/3/merge",
      "-X",
      "PUT",
      `-fsha=${head}`,
    ]);
    // A different head than the one that passed is still refused.
    refused(
      repo,
      ["glab", "mr", "merge", "7", "--sha", sha("main")],
      "no passing"
    );
  });

  test("gates pushes that update the target branch", async () => {
    const { git, pass, repo, sha } = await fixture();
    refused(repo, ["git", "push", "origin", "main"], sha("main"));
    refused(repo, ["git", "push"], "git push to main");
    refused(repo, ["git", "push", "origin", "feature:main"], sha("feature"));
    refused(
      repo,
      ["git", "push", "-f", "origin", "+HEAD:refs/heads/main"],
      "no passing"
    );
    refused(repo, ["git", "push", "origin", ":main"], "would delete main");
    refused(repo, ["git", "push", "--delete", "origin", "main"], "delete main");
    refused(repo, ["git", "push", "--all", "origin"], "every branch");
    refused(
      repo,
      ["git", "push", "origin", "refs/heads/*:refs/heads/*"],
      "wildcard"
    );
    refused(repo, ["git", "-C", repo, "push", "origin", "main"], "no passing");
    refused(
      repo,
      ["env", "A=1", "git", "push", "origin", "main"],
      "no passing"
    );
    pass("main");
    allowed(repo, ["git", "push", "origin", "main"]);
    allowed(repo, ["git", "push"]);
    allowed(repo, ["git", "push", "--all", "origin"]);
    refused(repo, ["git", "push", "origin", "feature:main"], "no passing");
    pass("feature");
    allowed(repo, ["git", "push", "origin", "feature:main"]);
    // On another branch, a bare push leaves main alone.
    git("checkout", "-q", "feature");
    git("branch", "-q", "--set-upstream-to=origin/main");
    allowed(repo, ["git", "push", "origin", "HEAD"]);
  });

  test("gates git merge only while the target branch is checked out", async () => {
    const { git, pass, repo } = await fixture();
    refused(
      repo,
      ["git", "merge", "--no-ff", "-m", "Merge feature", "feature"],
      "git merge into main"
    );
    allowed(repo, ["git", "merge", "--abort"]);
    pass("feature");
    allowed(repo, [
      "git",
      "merge",
      "--no-ff",
      "-m",
      "Merge feature",
      "feature",
    ]);
    git("checkout", "-q", "feature");
    allowed(repo, ["git", "merge", "main"]);
  });

  test("refuses a merge or push it cannot inspect", async () => {
    const { repo } = await fixture();
    refused(repo, ["sh", "-c", "git push origin main"], "cannot inspect");
    refused(
      repo,
      ["timeout", "60", "git", "merge", "feature"],
      "cannot inspect"
    );
    refused(repo, ["env", "-i", "git", "push"], "cannot inspect");
    refused(
      repo,
      ["git", "--git-dir=/elsewhere/.git", "push"],
      "hides which repository"
    );
  });

  test("exits 1 with a reason only for a refused command", async () => {
    const { repo } = await fixture();
    const run = async (argv: string[]) => {
      const child = spawn({
        cmd: [process.execPath, GUARD, ...argv],
        cwd: repo,
        stderr: "pipe",
        stdout: "pipe",
      });
      const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
      ]);
      return { exitCode, stderr };
    };
    const [push, status] = await Promise.all([
      run(["git", "push", "origin", "main"]),
      run(["git", "status"]),
    ]);
    expect(push.exitCode).toBe(1);
    expect(push.stderr).toContain("exec guard: git push to main");
    expect(status).toEqual({ exitCode: 0, stderr: "" });
  });
});
