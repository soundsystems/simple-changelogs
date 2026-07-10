import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "bun";

const temporaryDirectories: string[] = [];
const helper = new URL("../check-fork-sync.sh", import.meta.url).pathname;

const run = (
  cwd: string,
  argv: string[],
  environment: Record<string, string> = {}
) => {
  const result = spawnSync(argv, {
    cwd,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      ...environment,
    },
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
};

const git = (cwd: string, ...args: string[]): string => {
  const result = run(cwd, ["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout.trim();
};

const commitSkill = async (
  repository: string,
  contents: string,
  subject: string
): Promise<string> => {
  const skill = join(repository, "skills", "simple-changelogs", "SKILL.md");
  await mkdir(dirname(skill), { recursive: true });
  await writeFile(skill, contents);
  git(repository, "add", "--all");
  git(repository, "commit", "-m", subject, "--no-gpg-sign", "--no-verify");
  return git(repository, "rev-parse", "HEAD");
};

const setupRepository = async (): Promise<{
  base: string;
  forkSkill: string;
  main: string;
  repository: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "simple-changelogs-fork-sync-"));
  temporaryDirectories.push(root);
  const remote = join(root, "remote.git");
  const repository = join(root, "upstream");
  const forkSkill = join(root, "fork", "SKILL.md");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Fork Sync Test");
  git(repository, "config", "user.email", "fork-sync@example.invalid");
  git(repository, "remote", "add", "origin", remote);
  const base = await commitSkill(repository, "# Skill\n", "base skill");
  git(repository, "push", "-u", "origin", "main");
  const main = await commitSkill(
    repository,
    "# Skill\n\nUpdated.\n",
    "update skill"
  );
  git(repository, "push", "origin", "main");
  git(repository, "remote", "set-head", "origin", "main");
  await mkdir(dirname(forkSkill), { recursive: true });
  return { base, forkSkill, main, repository };
};

const pinFork = (path: string, pin: string): Promise<void> =>
  writeFile(
    path,
    `# Project Changelog Skill\n\nForked from \`simple-changelogs\` @ \`${pin}\`. Project-specific deltas: policy.\n`
  );

const check = (
  repository: string,
  forkSkill: string,
  ref?: string,
  environment: Record<string, string> = {}
) =>
  run(
    repository,
    ["sh", helper, forkSkill, repository, ...(ref ? [ref] : [])],
    environment
  );

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("bundled fork sync checker", () => {
  test("reports a pin at the selected ref as current", async () => {
    const fixture = await setupRepository();
    await pinFork(fixture.forkSkill, fixture.main);

    const result = check(fixture.repository, fixture.forkSkill, "origin/main");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("fork is current");
  });

  test("reports newer upstream skill commits as behind", async () => {
    const fixture = await setupRepository();
    await pinFork(fixture.forkSkill, fixture.base);

    const result = check(fixture.repository, fixture.forkSkill, "origin/main");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("newer commit");
    expect(result.stdout).toContain("update skill");
  });

  test("rejects malformed pins and missing refs", async () => {
    const fixture = await setupRepository();
    await writeFile(
      fixture.forkSkill,
      "Forked from `simple-changelogs` without a pin.\n"
    );
    const malformed = check(fixture.repository, fixture.forkSkill, "main");
    await pinFork(fixture.forkSkill, fixture.main);
    const missingRef = check(
      fixture.repository,
      fixture.forkSkill,
      "origin/missing"
    );

    expect(malformed.exitCode).toBe(2);
    expect(malformed.stderr).toContain("provenance pin");
    expect(missingRef.exitCode).toBe(2);
    expect(missingRef.stderr).toContain("ref");
  });

  test("distinguishes a divergent provenance pin", async () => {
    const fixture = await setupRepository();
    git(fixture.repository, "switch", "-c", "divergent", fixture.base);
    const divergent = await commitSkill(
      fixture.repository,
      "# Skill\n\nFork-only upstream line.\n",
      "divergent skill"
    );
    await pinFork(fixture.forkSkill, divergent);

    const result = check(fixture.repository, fixture.forkSkill, "origin/main");

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("diverg");
  });

  test("defaults to the remote symbolic default instead of local HEAD", async () => {
    const fixture = await setupRepository();
    git(fixture.repository, "switch", "-c", "feature", fixture.main);
    await commitSkill(
      fixture.repository,
      "# Skill\n\nFeature-only work.\n",
      "feature skill work"
    );
    await pinFork(fixture.forkSkill, fixture.main);

    const result = check(fixture.repository, fixture.forkSkill);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("origin/main");
  });

  test("falls back when the remote symbolic default is dangling", async () => {
    const fixture = await setupRepository();
    git(
      fixture.repository,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/missing"
    );
    await pinFork(fixture.forkSkill, fixture.main);

    const result = check(fixture.repository, fixture.forkSkill);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("origin/main");
  });

  test("reports merge-base operational failures as invalid", async () => {
    const fixture = await setupRepository();
    await pinFork(fixture.forkSkill, fixture.base);
    const bin = join(dirname(fixture.forkSkill), "bin");
    const wrapper = join(bin, "git");
    const gitPath = run(fixture.repository, ["which", "git"]).stdout.trim();
    await mkdir(bin);
    await writeFile(
      wrapper,
      `#!/bin/sh
case "$*" in
  *"merge-base --is-ancestor"*) exit 128 ;;
esac
exec ${JSON.stringify(gitPath)} "$@"
`
    );
    await chmod(wrapper, 0o755);

    const result = check(fixture.repository, fixture.forkSkill, "origin/main", {
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("merge-base");
  });
});
