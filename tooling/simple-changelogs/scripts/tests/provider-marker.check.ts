import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Distribution } from "../lib/types.ts";
import { inspectRepository, providerMarkerFor } from "../setup.ts";

const MARKER_FILENAME = "changelog-provider.json";
const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SKILLS_ROOT = join(REPOSITORY_ROOT, "skills");

// Consumers read this marker instead of inferring the distribution from a
// directory name or SKILL.md prose, so every advertised distribution ships one
// and it must stay byte-identical to what setup.ts computes at use time.
const MARKER_DIRECTORIES: ReadonlyArray<readonly [Distribution, string]> = [
  ["full", "simple-changelogs"],
  ["mobile", "simple-changelogs-mobile"],
  ["skill-repository", "simple-changelogs-skill-maintainer"],
  ["web", "simple-changelogs-web"],
  ["web-cms", "simple-changelogs-web-cms"],
];

const computeCapabilities = async (
  distribution: Distribution | "cms"
): Promise<unknown> => {
  const repo = await mkdtemp(join(tmpdir(), "changelog-provider-repo-"));
  const configDirectory = await mkdtemp(
    join(tmpdir(), "changelog-provider-config-")
  );
  try {
    const result = await inspectRepository({
      configDirectory,
      distribution,
      repo,
      taskMode: "read",
    });
    return result.capabilities;
  } finally {
    await Promise.all([
      rm(repo, { force: true, recursive: true }),
      rm(configDirectory, { force: true, recursive: true }),
    ]);
  }
};

const manifestGuidanceVersions = async (): Promise<Map<string, number>> => {
  const manifest = JSON.parse(
    await readFile(join(REPOSITORY_ROOT, "distribution-manifest.json"), "utf8")
  ) as { distributions: Array<{ guidanceVersion: number; name: string }> };
  return new Map(
    manifest.distributions.map((entry) => [entry.name, entry.guidanceVersion])
  );
};

describe("changelog-provider marker", () => {
  for (const [distribution, directoryName] of MARKER_DIRECTORIES) {
    test(`skills/${directoryName} ships a marker matching setup.ts`, async () => {
      const markerPath = join(SKILLS_ROOT, directoryName, MARKER_FILENAME);
      const [source, computed, declaredGuidance] = await Promise.all([
        readFile(markerPath, "utf8"),
        computeCapabilities(distribution),
        manifestGuidanceVersions(),
      ]);
      const marker = JSON.parse(source) as Record<string, unknown>;

      expect(marker).toEqual(computed as Record<string, unknown>);
      const expectedMarker: unknown = await providerMarkerFor(distribution);
      expect(marker).toEqual(expectedMarker as Record<string, unknown>);
      // The committed file is formatted by Biome, so assert stable key order
      // rather than exact bytes; a reordered marker still fails here.
      expect(Object.keys(marker)).toEqual(
        Object.keys(computed as Record<string, unknown>)
      );
      expect(marker.schemaVersion).toBe(1);
      expect(marker.provider).toBe("simple-changelogs");
      expect(marker.distribution).toBe(distribution);
      expect(marker.guidanceVersion).toBe(
        declaredGuidance.get(directoryName) as number
      );
      expect(marker.features).toContain("guidance-update-notices");
      expect(marker.requestVersions).toEqual([1]);
      expect(marker.receiptVersions).toEqual([1, 2]);
    });
  }

  // The CMS-only distribution takes the same three-phase handoff for its
  // version-less operator history, so its marker advertises the protocol and
  // schema digests while omitting the public-version features.
  test("skills/simple-changelogs-cms ships an entry-only handoff marker", async () => {
    const markerPath = join(
      SKILLS_ROOT,
      "simple-changelogs-cms",
      MARKER_FILENAME
    );
    const [source, computed, capabilities, declaredGuidance] =
      await Promise.all([
        readFile(markerPath, "utf8"),
        providerMarkerFor("cms") as Promise<unknown>,
        computeCapabilities("cms"),
        manifestGuidanceVersions(),
      ]);
    const marker = JSON.parse(source) as Record<string, unknown>;

    expect(marker).toEqual(computed as Record<string, unknown>);
    expect(marker).toEqual(capabilities as Record<string, unknown>);
    expect(Object.keys(marker)).toEqual(
      Object.keys(computed as Record<string, unknown>)
    );
    expect(marker.schemaVersion).toBe(1);
    expect(marker.provider).toBe("simple-changelogs");
    expect(marker.distribution).toBe("cms");
    expect(marker.guidanceVersion).toBe(
      declaredGuidance.get("simple-changelogs-cms") as number
    );
    expect(marker.features).toEqual([
      "classify-prepare-verify",
      "guidance-update-notices",
    ]);
    expect(marker.requestVersions).toEqual([1]);
    expect(marker.receiptVersions).toEqual([1, 2]);
    expect(marker.schemaDigests).toEqual(
      (await providerMarkerFor("full")).schemaDigests
    );
  });
});
