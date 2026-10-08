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

// A repository whose origin is a local bare repository with HEAD main, plus
// a feature branch; main has one unpushed commit.
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
  // main is one commit ahead of origin/main, so pushing it updates main.
  await writeFile(join(repo, "README.md"), "two\n");
  git("commit", "-qam", "two");
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
    const { git, repo } = await fixture();
    git("tag", "v1.0.0");
    for (const argv of [
      ["bun", "run", "check"],
      ["bun", "add", "merge-deep"],
      ["rg", "merge", "tooling"],
      ["git", "status"],
      ["git", "fetch", "origin"],
      ["git", "push", "origin", "feature"],
      ["git", "push", "origin", "v1.0.0"],
      ["git", "push", "--tags", "origin"],
      ["git", "merge", "--abort"],
      ["glab", "mr", "view", "7"],
      ["glab", "api", "projects/83469495/merge_requests/7"],
      ["glab", "api", "-X", "POST", "projects/83469495/merge_requests"],
      ["gh", "api", "repos/o/r/pulls/7/merge"],
      ["gh", "api", "-XGET", "repos/o/r/pulls/7/merge", "-f", "a=b"],
      ["gh", "api", "--paginate", "-H", "Accept: x", "repos/o/r/pulls/7/merge"],
      ["gh", "api", "graphql", "-f", "query=query { viewer { login } }"],
      ["gh", "--repo", "o/r", "pr", "view", "3"],
      ["glab", "mr", "list", "--search", "merge"],
      ["gh", "pr", "list", "--search", "merge"],
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
    refused(repo, ["glab", "--repo", "o/r", "mr", "merge", "7"], "--sha");
    refused(repo, ["glab", "mr", "accept", "7"], "--sha");
    refused(repo, ["gh", "pr", "merge", "3"], "--match-head-commit <head>");
    refused(repo, ["gh", "--repo", "o/r", "pr", "merge", "3"], "--match");
    refused(
      repo,
      ["glab", "api", "graphql", "-f", "query=mutation { mergeRequestAccept }"],
      "inline query"
    );
    refused(
      repo,
      ["gh", "api", "graphql", "-f", "query=mutation { updateRef(input: {}) }"],
      "inline query"
    );
    refused(
      repo,
      [
        "gh",
        "api",
        "repos/o/r/pulls/7/merge-async",
        "-X",
        "PUT",
        "-f",
        "merge_action=direct_merge",
      ],
      "must pin the head"
    );
    refused(
      repo,
      ["glab", "api", "-X", "POST", "projects/1/merge_trains/merge_requests/7"],
      "must pin the head"
    );
    for (const argv of [
      ["gh", "api", "repos/o/r/merges", "-f", "base=main", "-f", "head=x"],
      ["gh", "api", "-X", "PATCH", "repos/o/r/git/refs/heads/main"],
      ["gh", "api", "-X", "PUT", "repos/o/r/contents/README.md"],
      ["glab", "api", "-X", "POST", "projects/1/repository/commits"],
    ]) {
      refused(repo, argv, "writes refs, commits, or files directly");
    }
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
    allowed(repo, ["glab", "-R", "o/r", "mr", "merge", "7", `--sha=${head}`]);
    allowed(repo, ["gh", "pr", "merge", "3", "--match-head-commit", head]);
    allowed(repo, [
      "gh",
      "api",
      "repos/o/r/pulls/3/merge",
      "-X",
      "PUT",
      `-fsha=${head}`,
    ]);
    // The CLI keeps the last of a repeated option: a repeated method is not
    // a read, and a repeated sha is refused.
    refused(
      repo,
      [
        "gh",
        "api",
        "repos/o/r/pulls/3/merge",
        "-X",
        "GET",
        "-X",
        "PUT",
        "-f",
        `sha=${sha("main")}`,
      ],
      "no passing"
    );
    refused(
      repo,
      ["gh", "api", "repos/o/r/pulls/3/merge", "-XGET", "--method=PUT"],
      "must pin the head"
    );
    for (const argv of [
      [
        "gh",
        "api",
        `repos/o/r/pulls/3/merge?sha=${head}`,
        "-X",
        "PUT",
        "-f",
        `sha=${sha("main")}`,
      ],
      [
        "gh",
        "api",
        `repos/o/r/pulls/3/merge?sha=${head}&sha=${sha("main")}`,
        "-X",
        "PUT",
      ],
    ]) {
      refused(repo, argv, "repeats its sha");
    }
    // A body the guard cannot read is refused; a form field is a body.
    refused(
      repo,
      [
        "gh",
        "api",
        "-X",
        "PUT",
        "repos/o/r/pulls/3/merge",
        "--input",
        "x.json",
      ],
      "read from a file"
    );
    refused(
      repo,
      [
        "glab",
        "api",
        "projects/1/merge_trains/merge_requests/7",
        "--form",
        `sha=${sha("main")}`,
      ],
      "no passing"
    );
    for (const argv of [
      ["gh", "api", "graphql", "--input", "payload.json"],
      ["gh", "api", "graphql", "-F", "query=@payload.graphql"],
      ["glab", "api", "graphql", "-f", "query=mutation { x }"],
      ["gh", "api", "/graphql", "-f", "query=mutation { mergePullRequest }"],
      [
        "gh",
        "api",
        "https://api.github.com/graphql",
        "-f",
        "query=mutation { mergePullRequest }",
      ],
      ["glab", "api", "/api/graphql", "-f", "query=mutation { x }"],
    ]) {
      refused(repo, argv, "inline query");
    }
    refused(
      repo,
      ["glab", "mr", "merge", "7", `--sha=${head}`, "--sha", sha("main")],
      "repeats --sha"
    );
    refused(
      repo,
      [
        "gh",
        "pr",
        "merge",
        "3",
        "--match-head-commit",
        head,
        `--match-head-commit=${sha("main")}`,
      ],
      "repeats --match-head-commit"
    );
    // An option's value never poses as a head, endpoint, or method.
    refused(
      repo,
      [
        "gh",
        "pr",
        "merge",
        "7",
        "--merge",
        "--match-head-commit",
        sha("main"),
        "--body",
        `repos/o/r/pulls/7/merge?sha=${head}`,
      ],
      "no passing"
    );
    refused(
      repo,
      [
        "gh",
        "pr",
        "merge",
        "7",
        "--merge",
        "--body",
        `--match-head-commit=${head}`,
      ],
      "must pin the head"
    );
    refused(
      repo,
      ["glab", "mr", "merge", "7", "--yes", "--message", `--sha=${head}`],
      "must pin the head"
    );
    refused(
      repo,
      [
        "gh",
        "api",
        "repos/o/r/merges",
        "-f",
        "base=main",
        "-f",
        "head=x",
        "--template",
        "-XGET",
      ],
      "writes refs, commits, or files directly"
    );
    // Flags outside the command's table, or before its subcommand, refuse.
    refused(
      repo,
      ["gh", "pr", "merge", "3", "--match-head-commit", head, "--frobnicate"],
      "--frobnicate"
    );
    refused(repo, ["gh", "--frobnicate", "pr", "merge", "3"], "not inspected");
    refused(repo, ["gh", "pr", "--web", "merge", "3"], "not inspected");
    // Aliases and extensions can expand to a merge, so only built-ins run.
    refused(repo, ["gh", "pm", "123", "--merge"], "not a built-in command");
    refused(repo, ["glab", "mrm", "123", "--yes"], "not a built-in command");
    refused(repo, ["gh", "extension", "exec", "x"], "not a built-in command");
    refused(
      repo,
      ["gh", "repo", "sync", "o/r", "--branch", "main"],
      "repo sync"
    );
    // GraphQL from URL parameters, and merge endpoints however spelled.
    refused(
      repo,
      [
        "glab",
        "api",
        "https://gitlab.com/api/graphql?query=mutation%20%7B%20x%20%7D",
        "-X",
        "POST",
      ],
      "inline query"
    );
    refused(
      repo,
      ["gh", "api", "-X", "PUT", "repos/o/r/pulls/3/merge/"],
      "must pin the head"
    );
    refused(
      repo,
      ["glab", "api", "-X", "PUT", "projects/1/merge_requests/7/%6Derge"],
      "must pin the head"
    );
    // A namespaced project ID stays one path segment.
    refused(
      repo,
      [
        "glab",
        "api",
        "projects/soundsystems%2Fsimple-changelogs/merge_requests/7/merge",
        "-X",
        "PUT",
      ],
      "must pin the head"
    );
    refused(
      repo,
      [
        "glab",
        "api",
        "-X",
        "POST",
        "projects/group%2Fproject/merge_trains/merge_requests/7",
      ],
      "must pin the head"
    );
    refused(
      repo,
      [
        "glab",
        "api",
        "-X",
        "POST",
        "projects/group%2Fproject/repository/commits",
      ],
      "writes refs"
    );
    refused(
      repo,
      [
        "gh",
        "api",
        "-X",
        "POST",
        "repos/o/r/merge-upstream",
        "-f",
        "branch=main",
      ],
      "writes refs"
    );
    // -R and --repo may sit between the subcommand words.
    refused(
      repo,
      ["gh", "pr", "--repo", "o/r", "merge", "123", "--merge"],
      "--match-head-commit <head>"
    );
    refused(
      repo,
      ["glab", "mr", "-Ro/r", "merge", "123", "--yes"],
      "--sha <head>"
    );
    allowed(repo, [
      "glab",
      "mr",
      "--repo",
      "o/r",
      "merge",
      "123",
      "--sha",
      head,
    ]);
    refused(
      repo,
      ["glab", "api", "--frobnicate", "projects/1/merge_requests/7/merge"],
      "not inspected"
    );
    // A different head than the one that passed is still refused.
    refused(
      repo,
      ["glab", "mr", "merge", "7", "--sha", sha("main")],
      "no passing"
    );
  });

  test("gates every push Git reports would update the target branch", async () => {
    const { git, pass, repo, root, sha } = await fixture();
    const main = sha("main");
    for (const [cwd, argv] of [
      [repo, ["git", "push", "origin", "main"]],
      [repo, ["git", "push", "-q", "origin", "main"]],
      [repo, ["git", "push", "--no-dry-run", "origin", "main"]],
      [repo, ["git", "push", "--dry-run", "--no-dry-run", "origin", "main"]],
      [repo, ["git", "push", "--no-porcelain", "origin", "main"]],
      [repo, ["git", "push", "--dry-run", "origin", "main"]],
      [repo, ["git", "push"]],
      [repo, ["git", "push", "origin", ":"]],
      [repo, ["git", "push", "origin", "+:"]],
      [repo, ["git", "push", "--all", "origin"]],
      [repo, ["git", "push", "origin", "refs/heads/*:refs/heads/*"]],
      [repo, ["git", "push", "-f", "origin", "+HEAD:refs/heads/main"]],
      [repo, ["env", "A=1", "git", "push", "origin", "main"]],
      [root, ["git", "-C", repo, "push", "origin", "main"]],
      [
        root,
        [
          "git",
          `--git-dir=${join(repo, ".git")}`,
          `--work-tree=${repo}`,
          "push",
          "origin",
          "main",
        ],
      ],
    ] as const) {
      refused(cwd, [...argv], main);
    }
    refused(repo, ["git", "push", "origin", "feature:main"], sha("feature"));
    refused(repo, ["git", "push", "origin", ":main"], "would delete");
    refused(
      repo,
      ["git", "push", "--delete", "origin", "main"],
      "would delete"
    );
    refused(repo, ["git", "push", "nowhere", "main"], "--dry-run failed");
    refused(
      repo,
      ["git", "push", "origin", "main", "-o"],
      "ends with an option"
    );
    refused(repo, ["git", "push", "origin", "--", "main"], "with --");
    // Inspecting never pushed: origin still holds only its first commit.
    expect(gitIn(join(root, "origin.git"))("rev-parse", "main")).toBe(
      sha("origin/main")
    );
    pass("main");
    allowed(repo, ["git", "push", "origin", "main"]);
    allowed(repo, ["git", "push", "--all", "origin"]);
    allowed(repo, ["git", "push", "origin", ":"]);
    refused(repo, ["git", "push", "origin", "feature:main"], "no passing");
    // Configured push refspecs are Git's to resolve, not the argv's.
    git("checkout", "-q", "feature");
    refused(
      repo,
      ["git", "-c", "remote.origin.push=HEAD:main", "push", "origin"],
      sha("feature")
    );
    // The guard's dry run sees `env` assignments, not only inherited values.
    process.env.GUARD_REFS = "HEAD:refs/heads/feature";
    try {
      refused(
        repo,
        [
          "env",
          "GUARD_REFS=HEAD:refs/heads/main",
          "git",
          "--config-env=remote.origin.push=GUARD_REFS",
          "push",
          "origin",
        ],
        sha("feature")
      );
    } finally {
      Reflect.deleteProperty(process.env, "GUARD_REFS");
    }
    pass("feature");
    allowed(repo, ["git", "push", "origin", "feature:main"]);
  });

  test("gates git merge and named pulls only while the target branch is checked out", async () => {
    const { git, pass, repo } = await fixture();
    refused(
      repo,
      ["git", "merge", "--no-ff", "-m", "Merge feature", "feature"],
      "git merge into main"
    );
    for (const argv of [
      ["git", "pull"],
      ["git", "pull", "--ff-only"],
      ["git", "pull", "--ff-only", "--ff", "--no-rebase", "origin", "feature"],
      ["git", "-c", "branch.main.merge=refs/heads/feature", "pull", "origin"],
    ]) {
      refused(repo, argv, "git pull does not run on main");
    }
    refused(
      repo,
      ["git", "merge", "--abort", "--no-abort", "feature"],
      "no passing"
    );
    // Operands that can name another or several commits are refused, even
    // when the upstream and the first fetched head have receipts.
    pass("origin/main");
    git("fetch", "-q", "origin", "main");
    for (const argv of [
      ["git", "merge", "-"],
      ["git", "merge"],
      ["git", "merge", "--continue"],
      ["git", "merge", "FETCH_HEAD"],
      ["git", "merge", "MERGE_HEAD"],
    ]) {
      refused(repo, argv, "git merge into main");
    }
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
    allowed(repo, ["git", "pull", "origin", "main"]);
  });

  test("refuses merges and pushes it cannot inspect", async () => {
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
      ["env", "GIT_DIR=/elsewhere/.git", "git", "merge", "feature"],
      "GIT_ variables"
    );
    refused(
      repo,
      ["env", "GIT_CONFIG_COUNT=1", "git", "push", "origin", "feature"],
      "GIT_ variables"
    );
    refused(repo, ["bunx", "glab", "mr", "merge", "7"], "cannot inspect");
    refused(
      repo,
      [
        "curl",
        "-X",
        "PUT",
        "https://gitlab.com/api/v4/projects/1/merge_requests/7/merge",
      ],
      "cannot inspect"
    );
    for (const argv of [
      ["git", "-c", "alias.ship=push", "ship", "origin"],
      [
        "git",
        "-c",
        "alias.ship=publish",
        "-c",
        "alias.publish=push",
        "ship",
        "origin",
        "HEAD:main",
      ],
      ["git", "-c", "alias.lg=log", "lg", "-1"],
    ]) {
      refused(repo, argv, "not a built-in Git command");
    }
    refused(repo, ["git", "send-pack", "origin", "main"], "not inspected");
    refused(
      repo,
      ["git", "subtree", "push", "--prefix=docs", "origin", "main"],
      "not a built-in Git command"
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
    expect(push.stderr).toContain("exec guard: git push to refs/heads/main");
    expect(status).toEqual({ exitCode: 0, stderr: "" });
  });
});
