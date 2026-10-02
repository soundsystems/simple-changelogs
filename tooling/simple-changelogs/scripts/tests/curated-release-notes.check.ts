import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "bun";
import { validateRepoPolicy } from "../lib/validate.ts";
import { applySetup, parseCli } from "../setup.ts";

const setupScript = fileURLToPath(new URL("../setup.ts", import.meta.url));
const temporaryPaths: string[] = [];

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

const fixture = async (): Promise<{ config: string; repo: string }> => ({
  config: await temporaryDirectory("config"),
  repo: await temporaryDirectory("repo"),
});

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

const curatedPolicy = (budget?: { max: number; min: number }) => ({
  ...(budget === undefined ? {} : { curationBudget: budget }),
  developerChangelog: "required",
  distribution: "web",
  guidance: { backfillStatus: "completed", version: 20 },
  newReleaseNoteSurfaces: "ask",
  publicReleaseNotes: "curated",
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
});

const webOptions = (repo: string, configDirectory: string) => ({
  backfillStatus: "not-applicable" as const,
  configDirectory,
  confirm: true,
  distribution: "web" as const,
  repo,
  scope: "repository" as const,
});

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("curated release-note policy validation", () => {
  test("accepts a curated policy with and without an explicit budget", () => {
    expect(validateRepoPolicy(curatedPolicy()).ok).toBe(true);
    expect(validateRepoPolicy(curatedPolicy({ max: 8, min: 3 })).ok).toBe(true);
    expect(validateRepoPolicy(curatedPolicy({ max: 0, min: 0 })).ok).toBe(true);
  });

  test("rejects unsupported layer values and bad budgets", () => {
    expect(
      validateRepoPolicy({
        ...curatedPolicy(),
        publicReleaseNotes: "summary",
      }).ok
    ).toBe(false);
    expect(validateRepoPolicy(curatedPolicy({ max: 2, min: 5 })).ok).toBe(
      false
    );
    expect(validateRepoPolicy(curatedPolicy({ max: 8, min: 2.5 })).ok).toBe(
      false
    );
    expect(validateRepoPolicy(curatedPolicy({ max: -1, min: -3 })).ok).toBe(
      false
    );
    expect(
      validateRepoPolicy({
        ...curatedPolicy(),
        curationBudget: { max: 8, median: 5, min: 3 },
      }).ok
    ).toBe(false);
  });
});

describe("curated release-note setup", () => {
  test("onboarding records the curated layer and budget in repository policy", async () => {
    const { config, repo } = await fixture();
    const result = await applySetup({
      ...webOptions(repo, config),
      curationMax: 6,
      curationMin: 2,
      publicReleaseNotes: "curated",
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(result.status).toBe("configured");
    expect(result.summary).toContain("curated");
    expect(result.summary).toContain("2-6 highlights");
    expect(policy.publicReleaseNotes).toBe("curated");
    expect(policy.curationBudget).toEqual({ max: 6, min: 2 });
  });

  test("a lone or unanchored curation bound is blocked", async () => {
    const { config, repo } = await fixture();
    const lone = await applySetup({
      ...webOptions(repo, config),
      curationMin: 3,
    });
    expect(lone.status).toBe("blocked");
    expect(lone.errors.join(" ")).toContain(
      "--curation-min and --curation-max together"
    );

    const uncurated = await applySetup({
      ...webOptions(repo, config),
      curationMax: 8,
      curationMin: 3,
    });
    expect(uncurated.status).toBe("blocked");
    expect(uncurated.errors.join(" ")).toContain(
      "curated public release notes"
    );

    const inverted = await applySetup({
      ...webOptions(repo, config),
      curationMax: 2,
      curationMin: 5,
      publicReleaseNotes: "curated",
    });
    expect(inverted.status).toBe("blocked");
    expect(inverted.errors.join(" ")).toContain("must not exceed");
  });

  test("contextual updates record the layer once and report already-configured on identical re-run", async () => {
    const { config, repo } = await fixture();
    await applySetup(webOptions(repo, config));

    const changed = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      publicReleaseNotes: "curated",
      repo,
    });
    expect(changed.status).toBe("configured");
    const policy = await readJson(join(repo, ".simple-changelogs.json"));
    expect(policy.publicReleaseNotes).toBe("curated");

    const rerun = await applySetup({
      configDirectory: config,
      distribution: "web",
      publicReleaseNotes: "curated",
      repo,
    });
    expect(rerun.status).toBe("already-configured");

    const budget = await applySetup({
      configDirectory: config,
      confirm: true,
      curationMax: 5,
      curationMin: 1,
      distribution: "web",
      repo,
    });
    expect(budget.status).toBe("configured");
    const updated = await readJson(join(repo, ".simple-changelogs.json"));
    expect(updated.curationBudget).toEqual({ max: 5, min: 1 });
  });

  test("the CLI flags round-trip into stored policy", async () => {
    const { config, repo } = await fixture();
    const subprocess = spawn({
      cmd: [
        process.execPath,
        setupScript,
        "apply",
        "--public-release-notes",
        "curated",
        "--curation-min",
        "3",
        "--curation-max",
        "8",
        "--mobile-placement",
        "mobile-only",
        "--backfill",
        "not-applicable",
        "--scope",
        "repository",
        "--confirm",
        "--repo",
        repo,
      ],
      env: { ...process.env, SIMPLE_CHANGELOGS_CONFIG_DIR: config },
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout] = await Promise.all([
      subprocess.exited,
      new Response(subprocess.stdout).text(),
    ]);
    const result = JSON.parse(stdout) as {
      selection: Record<string, unknown>;
      status: string;
    };
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(exitCode).toBe(0);
    expect(result.status).toBe("configured");
    expect(result.selection.publicReleaseNotes).toBe("curated");
    expect(result.selection.curationBudget).toEqual({ max: 8, min: 3 });
    expect(policy.publicReleaseNotes).toBe("curated");
    expect(policy.curationBudget).toEqual({ max: 8, min: 3 });
    expect(validateRepoPolicy(policy).ok).toBe(true);
  });

  test("the CLI rejects a non-integer curation bound", async () => {
    const { config, repo } = await fixture();
    const subprocess = spawn({
      cmd: [
        process.execPath,
        setupScript,
        "apply",
        "--public-release-notes",
        "curated",
        "--curation-min",
        "two",
        "--curation-max",
        "8",
        "--repo",
        repo,
      ],
      env: { ...process.env, SIMPLE_CHANGELOGS_CONFIG_DIR: config },
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([
      subprocess.exited,
      new Response(subprocess.stderr).text(),
    ]);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("--curation-min must be a non-negative integer");
  });

  test("the CLI parser accepts only plain decimal non-negative integers", () => {
    const parse = (value: string) =>
      parseCli(["apply", "--curation-min", value]).options.curationMin;

    expect([parse("0"), parse("3"), parse("999999999")]).toEqual([
      0, 3, 999_999_999,
    ]);
    for (const value of [" ", "1e0", "0x3", "-1", "1.5", "01", "+1", "1e9"]) {
      expect(() => parse(value)).toThrow(
        "--curation-min must be a non-negative integer"
      );
    }
  });

  // Decision: a {0, 0} budget stays valid everywhere; every curated release
  // then publishes only its rollup line. The schemas' $comment records this.
  test("a zero-highlight curation budget is accepted", async () => {
    const { config, repo } = await fixture();
    const result = await applySetup({
      ...webOptions(repo, config),
      curationMax: 0,
      curationMin: 0,
      publicReleaseNotes: "curated",
    });

    expect(result.status).toBe("configured");
    expect(
      (await readJson(join(repo, ".simple-changelogs.json"))).curationBudget
    ).toEqual({ max: 0, min: 0 });
  });

  test("malformed stored curation state is reported, not replaced", async () => {
    const { config, repo } = await fixture();
    await writeFile(
      join(repo, ".simple-changelogs.json"),
      `${JSON.stringify(curatedPolicy({ max: 1, min: 9 }), null, 2)}\n`,
      "utf8"
    );
    const result = await applySetup(webOptions(repo, config));

    expect(result.status).toBe("blocked");
    expect(result.policy?.state).toBe("malformed");
    expect(result.policy?.errors.join(" ")).toContain("curationBudget");
  });
});
