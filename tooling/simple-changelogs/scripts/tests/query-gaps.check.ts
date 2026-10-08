import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

const queryPath = new URL("../query.ts", import.meta.url).pathname;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

interface GapsJson {
  checkedMerges: number;
  gaps: { commit: string; date: string; parents: string[]; subject: string }[];
  head: string;
  notes: string[];
  since: { commit: string; tag: string; template: string | null };
  uncheckedCommits: number;
}

const runQuery = async (
  args: string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const child = spawn({
    cmd: [process.execPath, queryPath, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const gapsJson = async (repo: string, args: string[] = []) => {
  const result = await runQuery(["gaps", "--repo", repo, "--json", ...args]);
  expect(result.stderr).toBe("");
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout) as GapsJson;
};

const subjects = (report: GapsJson): string[] =>
  report.gaps.map((gap) => gap.subject);

// A repository whose main line holds merges that add a customer entry, add
// only a developer entry, touch no changelog, and only delete a changelog
// line, plus a direct commit; tags name earlier releases in several styles.
const historyRepo = async (): Promise<{
  git: (...args: string[]) => string;
  repo: string;
}> => {
  const repo = await mkdtemp(join(tmpdir(), "query-gaps-"));
  temporaryDirectories.push(repo);
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        ...args,
      ],
      { encoding: "utf8" }
    ).trim();
  const commit = (message: string) => {
    git("add", "-A");
    git("commit", "-qm", message);
  };
  const mergeBranch = async (
    branch: string,
    change: () => Promise<void>,
    message = `Merge branch '${branch}'`
  ) => {
    git("checkout", "-qb", branch);
    await change();
    commit(`work on ${branch}`);
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "-m", message, branch);
  };
  git("init", "-q", "-b", "main");
  await writeFile(
    join(repo, "CHANGELOG.md"),
    "# Changelog\n\n## Unreleased\n\n- Old entry\n"
  );
  await writeFile(join(repo, "DEVELOPER_CHANGELOG.md"), "# Developer\n");
  await writeFile(join(repo, "app.txt"), "v1\n");
  commit("initial");
  git("tag", "v1.2.0");
  git("tag", "v1.10.0-rc.1");
  await appendFile(join(repo, "app.txt"), "rc\n");
  commit("release candidate");
  git("tag", "-a", "v1.10.0", "-m", "Example 1.10.0");
  git("tag", "web@3.0.0");
  // A newer-looking tag on a branch HEAD never reaches is ignored.
  git("checkout", "-qb", "side");
  await appendFile(join(repo, "app.txt"), "side\n");
  commit("side work");
  git("tag", "v9.0.0");
  git("checkout", "-q", "main");
  await mergeBranch("customer", () =>
    appendFile(join(repo, "CHANGELOG.md"), "- Customer entry\n")
  );
  await mergeBranch("developer", () =>
    appendFile(join(repo, "DEVELOPER_CHANGELOG.md"), "- Developer entry\n")
  );
  await mergeBranch("silent", async () => {
    await appendFile(join(repo, "app.txt"), "silent\n");
    // Merging main into the branch adds a merge off the first-parent line.
    git("add", "-A");
    git("commit", "-qm", "silent work");
    git("merge", "-q", "--no-ff", "-m", "Merge main into silent", "main");
    await appendFile(join(repo, "app.txt"), "after\n");
  });
  await mergeBranch("removal", () =>
    writeFile(join(repo, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n")
  );
  await appendFile(join(repo, "app.txt"), "direct\n");
  commit("direct commit on main");
  return { git, repo };
};

describe("query gaps", () => {
  test("lists merges since the newest reachable release tag that add no changelog lines", async () => {
    const { git, repo } = await historyRepo();
    const [both, customer, developer, text] = await Promise.all([
      gapsJson(repo),
      gapsJson(repo, ["--log", "customer"]),
      gapsJson(repo, ["--log", "developer"]),
      runQuery(["gaps", "--repo", repo]),
    ]);
    // v1.10.0 outranks v1.2.0 and its own release candidate; v9.0.0 is not
    // reachable from HEAD.
    expect(both.since).toEqual({
      commit: git("rev-parse", "v1.10.0^{commit}"),
      tag: "v1.10.0",
      template: "v{version}",
    });
    expect(both.head).toBe(git("rev-parse", "HEAD"));
    expect(both.checkedMerges).toBe(4);
    expect(subjects(both)).toEqual([
      "Merge branch 'removal'",
      "Merge branch 'silent'",
    ]);
    expect(both.uncheckedCommits).toBe(1);
    expect(both.notes.join("\n")).toContain("1 first-parent commits");
    expect(subjects(customer)).toEqual([
      "Merge branch 'removal'",
      "Merge branch 'silent'",
      "Merge branch 'developer'",
    ]);
    expect(subjects(developer)).toEqual([
      "Merge branch 'removal'",
      "Merge branch 'silent'",
      "Merge branch 'customer'",
    ]);
    const [gap] = both.gaps;
    expect(gap?.parents).toHaveLength(2);
    expect(gap?.date).toMatch(DAY_PATTERN);
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain("Since v1.10.0");
    expect(text.stdout).toContain("2 of 4 merges add no lines");
    expect(text.stdout).toContain("Merge branch 'silent'");
  });

  test("starts after an explicit tag and notes one HEAD does not contain", async () => {
    const { repo } = await historyRepo();
    const [earlier, side, missing] = await Promise.all([
      gapsJson(repo, ["--since", "v1.2.0"]),
      gapsJson(repo, ["--since", "v9.0.0"]),
      runQuery(["gaps", "--repo", repo, "--since", "v404"]),
    ]);
    expect(earlier.since.tag).toBe("v1.2.0");
    expect(earlier.since.template).toBeNull();
    expect(earlier.uncheckedCommits).toBe(2);
    expect(side.notes.join("\n")).toContain(
      "v9.0.0 is not an ancestor of HEAD"
    );
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("No tag named v404");
  });

  test("follows releaseTags templates, one per train when the policy maps them", async () => {
    const { repo } = await historyRepo();
    const policy = (releaseTags: unknown) =>
      writeFile(
        join(repo, ".simple-changelogs.json"),
        JSON.stringify({ releaseTags })
      );
    await policy({ api: "none", web: "web@{version}" });
    const onlyTemplate = await gapsJson(repo);
    expect(onlyTemplate.since.tag).toBe("web@3.0.0");
    const named = await gapsJson(repo, ["--train", "web"]);
    expect(named.since).toMatchObject({
      tag: "web@3.0.0",
      template: "web@{version}",
    });
    const untagged = await runQuery(["gaps", "--repo", repo, "--train", "api"]);
    expect(untagged.exitCode).toBe(1);
    expect(untagged.stderr).toContain("no tag template for api");

    await policy({ api: "api-v{version}", web: "web@{version}" });
    const ambiguous = await runQuery(["gaps", "--repo", repo]);
    expect(ambiguous.exitCode).toBe(1);
    expect(ambiguous.stderr).toContain("pass --train NAME or --since TAG");
    const none = await runQuery(["gaps", "--repo", repo, "--train", "api"]);
    expect(none.exitCode).toBe(1);
    expect(none.stderr).toContain("No tag reachable from HEAD matches");

    await policy("release-{version}");
    const unmatched = await runQuery(["gaps", "--repo", repo]);
    expect(unmatched.stderr).toContain("release-{version}");
    await policy("none");
    expect((await gapsJson(repo)).since.tag).toBe("v1.10.0");
  });

  test("ranks prereleases below their release and refuses a repository without Git", async () => {
    const { git, repo } = await historyRepo();
    git("tag", "v2.0.0-rc.2");
    git("tag", "v2.0.0-rc.10");
    git("tag", "v2.0.0-alpha");
    expect((await gapsJson(repo)).since.tag).toBe("v2.0.0-rc.10");
    git("tag", "v2.0.0");
    expect((await gapsJson(repo)).since.tag).toBe("v2.0.0");

    const plain = await mkdtemp(join(tmpdir(), "query-gaps-"));
    temporaryDirectories.push(plain);
    const outside = await runQuery(["gaps", "--repo", plain]);
    expect(outside.exitCode).toBe(1);
    expect(outside.stderr).toContain("git rev-parse failed");
    // --since stays a date filter for entries.
    const entries = await runQuery(["entries", "--since", "v1.0.0"]);
    expect(entries.stderr).toContain("YYYY-MM-DD");
  });
});
