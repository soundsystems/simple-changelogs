import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dir, "../../../..");

const distributions = [
  {
    guidanceVersion: 10,
    name: "simple-changelogs",
  },
  {
    guidanceVersion: 9,
    name: "simple-changelogs-web",
  },
  {
    guidanceVersion: 9,
    name: "simple-changelogs-web-cms",
  },
] as const;

const readDistributionFile = async (
  distribution: (typeof distributions)[number]["name"],
  path: string
): Promise<string> =>
  readFile(join(repositoryRoot, "skills", distribution, path), "utf8");

describe("web production release boundary", () => {
  for (const distribution of distributions) {
    test(`${distribution.name} requires versioned release reconciliation`, async () => {
      const [skill, lifecycle, versions, automation, updates] =
        await Promise.all([
          readDistributionFile(distribution.name, "SKILL.md"),
          readDistributionFile(
            distribution.name,
            "references/release-lifecycle.md"
          ),
          readDistributionFile(
            distribution.name,
            "references/version-decisions.md"
          ),
          readDistributionFile(
            distribution.name,
            "references/automation-verification.md"
          ),
          readDistributionFile(
            distribution.name,
            "references/guidance-updates.md"
          ),
        ]);

      expect(skill).toContain(
        `Current guidance version: ${distribution.guidanceVersion}`
      );
      expect(skill.replaceAll(/\s+/g, " ")).toContain(
        "A production Web deployment is always a product release"
      );
      expect(lifecycle).toContain(
        "A production deployment of a Web product is a product release."
      );
      expect(lifecycle).toContain(
        "no target-contained item remains under `Unreleased`"
      );
      expect(lifecycle).toContain("release reconciliation is unmerged");
      expect(versions).toContain(
        "Every production Web deployment must resolve to one product release version."
      );
      expect(versions).toContain("block production");
      expect(automation).toContain(
        "Every production Web target resolves to a product release version"
      );
      expect(updates).toContain(`## Guidance ${distribution.guidanceVersion}`);
    });
  }
});
