import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateCmsChangelog,
  validateCmsPolicy,
  validateRepository,
} from "../../../../skills/simple-changelogs-cms/scripts/lib/schema.ts";

const policy = () => ({
  changelogPath: "CMS_CHANGELOG.json",
  cmsSurface: {
    access: "authenticated-operators",
    route: "/admin/changelog",
  },
  guidance: { backfillStatus: "completed", version: 1 },
  newReleaseNoteSurfaces: "existing-only",
  schemaVersion: 1,
});

const changelog = () => ({
  entries: [
    {
      changes: ["Added a protected history view."],
      date: "2026-07-16",
      id: "2026-07-16-newest",
      kind: "release",
      summary: "The newest operator outcome.",
      title: "Newest",
    },
    {
      changes: ["Introduced the authenticated CMS."],
      date: "2026-07-15",
      id: "2026-07-15-older",
      kind: "backfill",
      summary: "An earlier operator outcome.",
      title: "Older",
      version: "1.0.0",
    },
  ],
  schemaVersion: 1,
  title: "CMS Changelog",
});

const entryAt = (value: ReturnType<typeof changelog>, index: number) => {
  const entry = value.entries[index];
  if (!entry) {
    throw new Error(`Missing CMS changelog fixture entry ${index}`);
  }
  return entry;
};

describe("CMS changelog policy", () => {
  test("accepts a contained source and authenticated operator route", () => {
    expect(validateCmsPolicy(policy()).errors).toEqual([]);
  });

  test("rejects public roots, path traversal, and unknown policy fields", () => {
    expect(
      validateCmsPolicy({
        ...policy(),
        changelogPath: "../CMS_CHANGELOG.json",
        cmsSurface: { access: "public", route: "/" },
        extra: true,
      }).errors.length
    ).toBeGreaterThan(0);
  });
});

describe("CMS changelog data", () => {
  test("accepts unique newest-first operator entries", () => {
    expect(validateCmsChangelog(changelog()).errors).toEqual([]);
  });

  test("rejects duplicate IDs, impossible dates, and oldest-first data", () => {
    const invalidDate = changelog();
    invalidDate.entries[0] = {
      ...entryAt(invalidDate, 0),
      date: "2026-02-30",
    };
    expect(validateCmsChangelog(invalidDate).errors.join("\n")).toContain(
      "real YYYY-MM-DD date"
    );

    const duplicateAndOldestFirst = changelog();
    duplicateAndOldestFirst.entries = [
      { ...entryAt(duplicateAndOldestFirst, 1), id: "same" },
      { ...entryAt(duplicateAndOldestFirst, 0), id: "same" },
    ];
    const structuralErrors = validateCmsChangelog(
      duplicateAndOldestFirst
    ).errors.join("\n");
    expect(structuralErrors).toContain("duplicated");
    expect(structuralErrors).toContain("newest-first");
  });
});

describe("repository validation", () => {
  test("validates policy and its configured source together", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-changelogs-cms-"));
    await Promise.all([
      writeFile(
        join(root, ".simple-changelogs-cms.json"),
        `${JSON.stringify(policy(), null, 2)}\n`
      ),
      writeFile(
        join(root, "CMS_CHANGELOG.json"),
        `${JSON.stringify(changelog(), null, 2)}\n`
      ),
    ]);
    expect(await validateRepository(root)).toEqual([]);
  });
});
