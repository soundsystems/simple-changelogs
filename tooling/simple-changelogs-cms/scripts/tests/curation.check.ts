import { describe, expect, test } from "bun:test";
import {
  cmsChangeId,
  validateCmsChangelog,
} from "../../../../skills/simple-changelogs-cms/scripts/lib/schema.ts";

const CHANGES = [
  "Added a protected history view.",
  "Improved operator search speed.",
  "**Breaking** Renamed the export endpoint.",
];

const ids = CHANGES.map((change) => cmsChangeId(change));

const changelogWith = (
  entry: Record<string, unknown>
): Record<string, unknown> => ({
  entries: [
    {
      changes: CHANGES,
      date: "2026-07-16",
      id: "2026-07-16-curated",
      kind: "release",
      summary: "The curated operator outcome.",
      title: "Curated",
      ...entry,
    },
  ],
  schemaVersion: 1,
  title: "CMS Changelog",
});

describe("CMS curated highlights", () => {
  test("accepts highlights alone without a curation accounting object", () => {
    expect(
      validateCmsChangelog(changelogWith({ highlights: ["Search is faster."] }))
        .errors
    ).toEqual([]);
    expect(
      validateCmsChangelog(changelogWith({ highlights: [""] })).errors.join(
        "\n"
      )
    ).toContain("highlights");
  });

  test("accepts a curation object that accounts every change exactly once", () => {
    expect(
      validateCmsChangelog(
        changelogWith({
          curation: {
            highlighted: [ids[0], ids[2]],
            omitted: [],
            rolledUp: [ids[1]],
          },
          highlights: ["A protected history view is available."],
        })
      ).errors
    ).toEqual([]);
  });

  test("rejects unknown ids, unaccounted changes, and double accounting", () => {
    const unknown = validateCmsChangelog(
      changelogWith({
        curation: {
          highlighted: ["0123456789ab"],
          omitted: [],
          rolledUp: [ids[1], ids[2]],
        },
      })
    ).errors.join("\n");
    expect(unknown).toContain("unknown change id");
    expect(unknown).toContain("unaccounted");

    const doubled = validateCmsChangelog(
      changelogWith({
        curation: {
          highlighted: [ids[0], ids[2]],
          omitted: [ids[1]],
          rolledUp: [ids[1]],
        },
      })
    ).errors.join("\n");
    expect(doubled).toContain("more than once");
  });

  test("never lets a breaking or security change be omitted or rolled up", () => {
    const omitted = validateCmsChangelog(
      changelogWith({
        curation: {
          highlighted: [ids[0]],
          omitted: [ids[2]],
          rolledUp: [ids[1]],
        },
      })
    ).errors.join("\n");
    expect(omitted).toContain("breaking or security");

    const security = validateCmsChangelog(
      changelogWith({
        changes: ["**Security** Fixed a session fixation issue."],
        curation: {
          highlighted: [],
          omitted: [],
          rolledUp: [
            cmsChangeId("**Security** Fixed a session fixation issue."),
          ],
        },
      })
    ).errors.join("\n");
    expect(security).toContain("breaking or security");
  });

  test("rejects malformed curation shapes and duplicate change text", () => {
    expect(
      validateCmsChangelog(
        changelogWith({
          curation: { highlighted: ["not-hex"], omitted: [], rolledUp: [] },
        })
      ).errors.join("\n")
    ).toContain("12-hex change ids");

    const duplicateChange = CHANGES[0] as string;
    expect(
      validateCmsChangelog(
        changelogWith({
          changes: [duplicateChange, duplicateChange],
          curation: {
            highlighted: [cmsChangeId(duplicateChange)],
            omitted: [],
            rolledUp: [],
          },
        })
      ).errors.join("\n")
    ).toContain("unique");
  });
});
