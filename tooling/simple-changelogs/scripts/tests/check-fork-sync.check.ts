import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "bun";

const temporaryDirectories: string[] = [];
const helper = new URL(
  "../../../../skills/simple-changelogs/scripts/check-fork-sync.sh",
  import.meta.url
).pathname;

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
  subject: string,
  skillName = "simple-changelogs"
): Promise<string> => {
  const skill = join(repository, "skills", skillName, "SKILL.md");
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

const pinFork = (
  path: string,
  pin: string,
  skillName = "simple-changelogs"
): Promise<void> =>
  writeFile(
    path,
    `# Project Changelog Skill\n\nForked from \`${skillName}\` @ \`${pin}\`. Project-specific deltas: policy.\n`
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

const checkParity = (
  repository: string,
  forkSkill: string,
  ...extra: string[]
) =>
  run(repository, [
    "sh",
    helper,
    "--pin-parity",
    forkSkill,
    repository,
    ...extra,
  ]);

const writeFiles = async (
  root: string,
  files: Record<string, string>
): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([path, contents]) => {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
    })
  );
};

const UPSTREAM_FILES: Record<string, string> = {
  "references/notes.md":
    "# Notes\n\n## Web\n\n### Caveats\n\nWeb caveats.\n\n## Mobile\n\n### Caveats\n\nMobile caveats.\n",
  "references/onboarding.md":
    "# Onboarding\n\n## Explain before asking\n\nExplain each choice first.\n\n```md\n## Fenced example heading\n```\n\n## Final history question\n\nAsk last.\n",
  "SKILL.md": "# Skill\n\n## Workflow\n\nUpstream workflow.\n",
  "scripts/helper.sh": "#!/bin/sh\nexit 0\n",
};

// Pin parity only reads upstream, so one repository serves every parity test.
// Its single commit is the pin, so the default drift check calls a fork
// current even when the fork never received the pinned files.
const createParityUpstream = async (): Promise<{
  pin: string;
  repository: string;
  root: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "simple-changelogs-pin-parity-"));
  const repository = join(root, "upstream");
  await writeFiles(
    join(repository, "skills", "simple-changelogs"),
    UPSTREAM_FILES
  );
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Fork Sync Test");
  git(repository, "config", "user.email", "fork-sync@example.invalid");
  git(repository, "add", "--all");
  git(repository, "commit", "-m", "skill", "--no-gpg-sign", "--no-verify");
  const pin = git(repository, "rev-parse", "--short=8", "HEAD");
  return { pin, repository, root };
};

const createFork = async (
  pin: string
): Promise<{ forkDirectory: string; forkSkill: string }> => {
  const forkDirectory = await mkdtemp(
    join(tmpdir(), "simple-changelogs-fork-")
  );
  temporaryDirectories.push(forkDirectory);
  await writeFiles(forkDirectory, {
    ...UPSTREAM_FILES,
    "SKILL.md": `# Project Skill\n\nForked from \`simple-changelogs\` @ \`${pin}\`. Project-specific deltas: audiences.\n\n## Workflow\n\nProject workflow.\n`,
  });
  return { forkDirectory, forkSkill: join(forkDirectory, "SKILL.md") };
};

// Every table starts with the fork's SKILL.md delta. The fenced example names
// a file upstream never had, so a parser that read it would report it stale.
const declareDeltas = (forkDirectory: string, ...rows: string[]) =>
  writeFiles(forkDirectory, {
    "references/fork-maintenance.md": [
      "# Fork Maintenance",
      "",
      "## Current Deltas",
      "",
      "```md",
      "| Kind | Path | Section | Reason |",
      "| --- | --- | --- | --- |",
      "| delta | `references/example.md` | | Never read |",
      "```",
      "",
      "| Kind | Path | Section | Reason |",
      "| --- | --- | --- | --- |",
      "| delta | `SKILL.md` | | Project name and pin |",
      ...rows,
      "",
    ].join("\n"),
  });

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

  test("selects a narrower upstream distribution from fork provenance", async () => {
    const fixture = await setupRepository();
    const skillName = "simple-changelogs-web";
    const base = await commitSkill(
      fixture.repository,
      "# Web skill\n",
      "base web skill",
      skillName
    );
    git(fixture.repository, "push", "origin", "main");
    await commitSkill(
      fixture.repository,
      "# Web skill\n\nUpdated.\n",
      "update web skill",
      skillName
    );
    git(fixture.repository, "push", "origin", "main");
    await pinFork(fixture.forkSkill, base, skillName);

    const result = check(fixture.repository, fixture.forkSkill, "origin/main");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("skills/simple-changelogs-web");
    expect(result.stdout).toContain("update web skill");
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

  test("uses a selected non-origin remote main ref without a symbolic default", async () => {
    const fixture = await setupRepository();
    const remoteUrl = git(fixture.repository, "remote", "get-url", "origin");
    git(fixture.repository, "remote", "add", "upstream", remoteUrl);
    git(
      fixture.repository,
      "fetch",
      "upstream",
      "main:refs/remotes/upstream/main"
    );
    git(fixture.repository, "remote", "remove", "origin");
    git(fixture.repository, "update-ref", "-d", "refs/remotes/upstream/HEAD");
    await pinFork(fixture.forkSkill, fixture.main);

    const result = check(fixture.repository, fixture.forkSkill);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("upstream/main");
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

describe("pin parity", () => {
  let upstream = { pin: "", repository: "", root: "" };

  beforeAll(async () => {
    upstream = await createParityUpstream();
  });

  afterAll(async () => {
    await rm(upstream.root, { force: true, recursive: true });
  });

  test("passes a fork that matches its pin apart from declared deltas", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(fork.forkDirectory);

    const result = checkParity(upstream.repository, fork.forkSkill);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "fork matches upstream skills/simple-changelogs"
    );
    expect(result.stdout).toContain(
      "1 declared delta(s) and 0 declared omission(s)"
    );
  });

  test("fails undeclared drift in a file that predates the pin", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(fork.forkDirectory);
    await writeFiles(fork.forkDirectory, {
      "references/onboarding.md":
        "# Onboarding\n\n## Final history question\n\nAsk last.\n",
    });

    const drift = check(upstream.repository, fork.forkSkill, "main");
    const parity = checkParity(upstream.repository, fork.forkSkill);

    expect(drift.exitCode).toBe(0);
    expect(drift.stdout).toContain("fork is current");
    expect(parity.exitCode).toBe(1);
    expect(parity.stdout).toContain("undeclared drift");
    expect(parity.stdout).toContain("  references/onboarding.md\n");
  });

  test("passes a declared delta that keeps every upstream heading", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(
      fork.forkDirectory,
      "| delta | `references/onboarding.md` | | Project audiences |"
    );
    await writeFiles(fork.forkDirectory, {
      "references/onboarding.md":
        "# Onboarding\n\n## Explain before asking\n\nExplain each project choice.\n\n### Final history question\n\nAsk last.\n",
    });

    const result = checkParity(upstream.repository, fork.forkSkill);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2 declared delta(s)");
  });

  test("requires every upstream heading in a declared delta unless the section is omitted", async () => {
    const fork = await createFork(upstream.pin);
    const delta =
      "| delta | `references/onboarding.md` | | Project audiences |";
    await declareDeltas(fork.forkDirectory, delta);
    await writeFiles(fork.forkDirectory, {
      "references/onboarding.md":
        "# Onboarding\n\n## Final history question\n\nAsk last.\n",
    });
    const missing = checkParity(upstream.repository, fork.forkSkill);
    await declareDeltas(
      fork.forkDirectory,
      delta,
      "| omit | `references/onboarding.md` | Explain before asking | Choices explain themselves |"
    );
    const omitted = checkParity(upstream.repository, fork.forkSkill);

    expect(missing.exitCode).toBe(1);
    expect(missing.stdout).toContain(
      "references/onboarding.md: Explain before asking"
    );
    expect(missing.stdout).not.toContain("Fenced example heading");
    expect(omitted.exitCode).toBe(0);
    expect(omitted.stdout).toContain("1 declared omission(s)");
  });

  test("counts a repeated upstream heading once per occurrence", async () => {
    const fork = await createFork(upstream.pin);
    const delta = "| delta | `references/notes.md` | | Project caveats |";
    await declareDeltas(fork.forkDirectory, delta);
    await writeFiles(fork.forkDirectory, {
      "references/notes.md":
        "# Notes\n\n## Web\n\n### Caveats\n\nProject web caveats.\n\n## Mobile\n\nMobile has none.\n",
    });
    const missing = checkParity(upstream.repository, fork.forkSkill);
    await declareDeltas(
      fork.forkDirectory,
      delta,
      "| omit | `references/notes.md` | Caveats #2 | Mobile has no caveats |"
    );
    const omitted = checkParity(upstream.repository, fork.forkSkill);

    expect(missing.exitCode).toBe(1);
    expect(missing.stdout).toContain("references/notes.md: Caveats #2");
    expect(omitted.exitCode).toBe(0);
    expect(omitted.stdout).toContain("1 declared omission(s)");
  });

  test("passes a declared omission of an upstream file", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(fork.forkDirectory);
    await rm(join(fork.forkDirectory, "scripts", "helper.sh"));
    const missing = checkParity(upstream.repository, fork.forkSkill);
    await declareDeltas(
      fork.forkDirectory,
      "| omit | `scripts/helper.sh` | | The fork needs no helper |"
    );
    const omitted = checkParity(upstream.repository, fork.forkSkill);

    expect(missing.exitCode).toBe(1);
    expect(missing.stdout).toContain("missing upstream files");
    expect(missing.stdout).toContain("  scripts/helper.sh\n");
    expect(omitted.exitCode).toBe(0);
    expect(omitted.stdout).toContain("1 declared omission(s)");
  });

  test("reports declarations that no longer match the fork as stale", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(
      fork.forkDirectory,
      "| delta | `scripts/helper.sh` | | Was customized |",
      "| omit | `references/onboarding.md` | | Was left out |",
      "| omit | `references/onboarding.md` | Final history question | Was dropped |",
      "| omit | `references/retired.md` | | Removed upstream |"
    );

    const result = checkParity(upstream.repository, fork.forkSkill);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("stale declarations");
    expect(result.stdout).toContain("delta scripts/helper.sh: matches the pin");
    expect(result.stdout).toContain(
      "omit references/onboarding.md: the fork carries this file"
    );
    expect(result.stdout).toContain(
      "omit references/onboarding.md: Final history question: the fork has this heading"
    );
    expect(result.stdout).toContain(
      "omit references/retired.md: not an upstream file at the pin"
    );
  });

  test("rejects malformed declarations and a ref argument", async () => {
    const fork = await createFork(upstream.pin);
    await declareDeltas(
      fork.forkDirectory,
      "| removed | `scripts/helper.sh` | | Typo |"
    );

    const malformed = checkParity(upstream.repository, fork.forkSkill);
    const withRef = checkParity(upstream.repository, fork.forkSkill, "main");

    expect(malformed.exitCode).toBe(2);
    expect(malformed.stderr).toContain("unknown kind 'removed'");
    expect(withRef.exitCode).toBe(2);
    expect(withRef.stderr).toContain("--pin-parity");
  });
});
