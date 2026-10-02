import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SharedVersionLineMode } from "../lib/types.ts";
import {
  bumpSharedCollision,
  compareVersions,
  directionRefusal,
  type Impact,
  isOrderableVersion,
  latestStableVersion,
  nextVersion,
  selectLineVersion,
  versionLineEvidence,
  versionLineViolations,
} from "../lib/version-lines.ts";

const REFERENCES = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "skills",
  "simple-changelogs",
  "references"
);
const EXAMPLES_MARKER = "<!-- shared-version-line-examples -->";
const EVIDENCE_EXAMPLE = /`(versionLine \{[^`]+\})`/u;

const EVIDENCE_PREFIX = /^versionLine /u;
const SAVED_VALUE = /Save [^.]*\./gu;
const GENERATED_VERSIONS = [
  null,
  "0.9.0",
  "0.21.0",
  "0.21.3",
  "1.0",
  "1.0.0",
  "1.2",
];
const GENERATED_IMPACTS: Impact[] = ["none", "patch", "minor", "major"];
// Every mode, version pair, and impact pair for a two-train line.
const GENERATED_LINES = (["catch-up", "bump-shared"] as const).flatMap((mode) =>
  GENERATED_VERSIONS.flatMap((web) =>
    GENERATED_VERSIONS.flatMap((mobile) =>
      GENERATED_IMPACTS.flatMap((webImpact) =>
        GENERATED_IMPACTS.map((mobileImpact) => ({
          firstVersion: "0.1.0",
          impacts: { mobile: mobileImpact, web: webImpact },
          memberVersions: { mobile, web },
          mode,
        }))
      )
    )
  )
);

const reference = await readFile(
  join(REFERENCES, "shared-version-lines.md"),
  "utf8"
);
const collapse = (value: string): string => value.replace(/\s+/gu, " ");

interface Example {
  impacts: Record<string, Impact>;
  memberVersions: Record<string, string | null>;
  mode: SharedVersionLineMode;
  outcome: string;
  row: string;
  selected: string;
}

const pairs = (cell: string): [string, string][] =>
  cell.split(", ").map((pair) => {
    const [train = "", value = ""] = pair.split(" ");
    return [train, value];
  });

// Reads the worked-example table so the guidance and the model cannot drift.
const examples = (): Example[] => {
  const lines = reference.slice(reference.indexOf(EXAMPLES_MARKER)).split("\n");
  const end = lines.findIndex(
    (line, index) => index > 2 && !line.startsWith("| ")
  );
  return lines.slice(3, end).map((row) => {
    const [mode, before, ships, selected, outcome] = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    return {
      impacts: Object.fromEntries(pairs(ships ?? "")) as Record<string, Impact>,
      memberVersions: Object.fromEntries(
        pairs(before ?? "").map(([train, version]) => [
          train,
          version === "-" ? null : version,
        ])
      ),
      mode: mode as SharedVersionLineMode,
      outcome: outcome ?? "",
      row,
      selected: selected ?? "",
    };
  });
};

const released = (
  input: Parameters<typeof selectLineVersion>[0]
): NonNullable<ReturnType<typeof selectLineVersion>> => {
  const result = selectLineVersion(input);
  if (!result) {
    throw new Error("Expected a release");
  }
  return result;
};

// Returns [selected, outcome, violations], with "-" for no release.
const outcomeOf = (example: Example): [string, string, string[]] => {
  const result = selectLineVersion(example);
  return result
    ? [
        result.selected,
        result.decision.outcome,
        versionLineViolations(result.decision, selectedByTrain(result)),
      ]
    : ["-", "-", []];
};

const selectedByTrain = (
  result: NonNullable<ReturnType<typeof selectLineVersion>>
): Record<string, string> =>
  Object.fromEntries(
    result.trains.map(({ train }) => [train, result.selected])
  );

describe("shared version line selection", () => {
  test("matches every worked example in the full guidance", () => {
    const rows = examples();

    expect(rows.length).toBeGreaterThanOrEqual(9);
    expect(new Set(rows.map(({ mode }) => mode))).toEqual(
      new Set(["catch-up", "bump-shared"])
    );
    expect(
      rows.some((row) => Object.keys(row.memberVersions).length === 3)
    ).toBe(true);
    for (const example of rows) {
      expect(outcomeOf(example), example.row).toEqual([
        example.selected,
        example.outcome,
        [],
      ]);
    }
  });

  test("Web reaching 1.0 makes Mobile's next patch release 1.0 with patch wording", () => {
    const result = released({
      impacts: { mobile: "patch" },
      memberVersions: { mobile: "0.21.3", web: "1.0.0" },
      mode: "catch-up",
    });

    expect(result.selected).toBe("1.0.0");
    expect(result.decision.outcome).toBe("catch-up");
    expect(result.trains).toEqual([
      {
        forcesAsk: true,
        policyLevel: "major",
        train: "mobile",
        wordingImpact: "patch",
      },
    ]);
    expect(versionLineEvidence(result.decision)).toBe(
      EVIDENCE_EXAMPLE.exec(reference)?.[1] ?? "missing evidence example"
    );
    expect(collapse(reference)).toContain(
      "Mobile's next release ships `1.0.0`, even when its own changes are patch-level"
    );
  });

  test("Web reaching 1.1 first makes Mobile catch up to 1.1 and skip 1.0", () => {
    const result = released({
      impacts: { mobile: "patch" },
      memberVersions: { mobile: "0.21.3", web: "1.1.0" },
      mode: "catch-up",
    });

    expect(result.selected).toBe("1.1.0");
    expect(result.decision.outcome).toBe("catch-up");
    expect(result.trains[0]?.wordingImpact).toBe("patch");
    expect(collapse(reference)).toContain(
      "Mobile catches up to `1.1.0` and skips `1.0.0`"
    );
  });

  test("a behind train ships exactly the head across several numbers it never shipped", () => {
    expect(
      released({
        impacts: { mobile: "patch" },
        memberVersions: { mobile: "0.21.0", web: "0.21.3" },
        mode: "catch-up",
      }).selected
    ).toBe("0.21.3");
  });

  test("a release set moves every shipping train to one next number at the highest impact", () => {
    const result = released({
      impacts: { mobile: "patch", web: "minor" },
      memberVersions: { mobile: "0.21.0", web: "0.21.1" },
      mode: "catch-up",
    });

    expect(result.selected).toBe("0.22.0");
    expect(result.decision.outcome).toBe("advance");
    expect(result.trains.map(({ train }) => train)).toEqual(["mobile", "web"]);
    expect(result.trains.map(({ wordingImpact }) => wordingImpact)).toEqual([
      "patch",
      "minor",
    ]);
  });

  test("a train with no target-contained changes never releases to catch up", () => {
    for (const mode of ["catch-up", "bump-shared"] as const) {
      expect(
        selectLineVersion({
          impacts: { mobile: "none", web: "none" },
          memberVersions: { mobile: "0.21.0", web: "1.0.0" },
          mode,
        })
      ).toBeNull();
    }
  });

  test("bump-shared always advances and lets non-shipping members skip", () => {
    const result = released({
      impacts: { mobile: "patch" },
      memberVersions: { mobile: "0.21.0", web: "0.21.1" },
      mode: "bump-shared",
    });

    expect(result.selected).toBe("0.21.2");
    expect(result.decision.outcome).toBe("advance");
    expect(result.trains.map(({ train }) => train)).toEqual(["mobile"]);
  });

  test("a train before its first stable release catches up to a three-train line", () => {
    const result = released({
      impacts: { android: "major" },
      memberVersions: { android: null, ios: "1.0.0", web: "1.1.0" },
      mode: "catch-up",
    });

    expect(result.selected).toBe("1.1.0");
    expect(result.decision).toEqual({
      members: ["android", "ios", "web"],
      memberVersions: { android: null, ios: "1.0.0", web: "1.1.0" },
      mode: "catch-up",
      outcome: "catch-up",
      sharedVersion: "1.1.0",
      sharedVersionTrains: ["web"],
    });
  });

  test("separate lines never read each other's numbers and reject outside trains", () => {
    const desktop = released({
      impacts: { windows: "patch" },
      memberVersions: { macos: "0.3.0", windows: "0.2.0" },
      mode: "catch-up",
    });

    expect(desktop.selected).toBe("0.3.0");
    expect(desktop.decision.sharedVersionTrains).toEqual(["macos"]);
    expect(() =>
      selectLineVersion({
        impacts: { web: "patch" },
        memberVersions: { macos: "0.3.0", windows: "0.2.0" },
        mode: "catch-up",
      })
    ).toThrow("not a member");
  });

  test("a line with no stable member advances from the normally chosen first number", () => {
    const result = released({
      firstVersion: "0.1.0",
      impacts: { mobile: "minor", web: "minor" },
      memberVersions: { mobile: null, web: null },
      mode: "catch-up",
    });

    expect(result.selected).toBe("0.1.0");
    expect(result.decision.outcome).toBe("advance");
    expect(result.decision.sharedVersionTrains).toEqual([]);
  });

  test("never lowers or reuses a train's own number across generated lines", () => {
    const outcomes = GENERATED_LINES.map((line) => ({
      line,
      result: selectLineVersion(line),
    }));
    const releases = outcomes.flatMap(({ result }) => (result ? [result] : []));

    expect(releases.length).toBeGreaterThan(1000);
    expect(
      outcomes
        .filter(({ result }) => result === null)
        .every(({ line }) =>
          Object.values(line.impacts).every((impact) => impact === "none")
        )
    ).toBe(true);
    expect(
      releases.flatMap((result) =>
        versionLineViolations(result.decision, selectedByTrain(result))
      )
    ).toEqual([]);
  });

  test("the invariant check catches a broken decision", () => {
    const decision = {
      members: ["mobile", "web"],
      memberVersions: { mobile: "0.21.0", web: "0.21.1" },
      mode: "bump-shared" as const,
      outcome: "catch-up" as const,
      sharedVersion: "0.21.1",
      sharedVersionTrains: ["web"],
    };

    expect(versionLineViolations(decision, { mobile: "0.21.1" })).toContain(
      "bump-shared always advances"
    );
    expect(
      versionLineViolations(
        { ...decision, mode: "catch-up", outcome: "advance" },
        { mobile: "0.21.1", web: "0.21.2" }
      )
    ).toEqual(
      expect.arrayContaining([
        "every train in one release set selects the same number",
        "mobile advance must exceed 0.21.1",
      ])
    );
    expect(
      versionLineViolations(
        { ...decision, mode: "catch-up" },
        { mobile: "0.21.0" }
      )
    ).toEqual(
      expect.arrayContaining([
        "mobile must exceed its own 0.21.0",
        "mobile catch-up must select 0.21.1",
      ])
    );
  });
});

describe("shared version line evidence and verification", () => {
  test("evidence carries exactly the future versionLine fields", () => {
    const result = released({
      impacts: { ios: "patch" },
      memberVersions: { android: "1.0.0", ios: "0.9.0", web: "1.0.0" },
      mode: "catch-up",
    });
    const evidence = versionLineEvidence(result.decision);
    const body = JSON.parse(evidence.replace(EVIDENCE_PREFIX, "")) as Record<
      string,
      unknown
    >;

    expect(evidence.startsWith("versionLine {")).toBe(true);
    expect(Object.keys(body)).toEqual([
      "members",
      "memberVersions",
      "mode",
      "outcome",
      "sharedVersion",
      "sharedVersionTrains",
    ]);
    expect(body.members).toEqual(["android", "ios", "web"]);
    expect(body.sharedVersionTrains).toEqual(["android", "web"]);
  });

  test("exact direction is validated against the line, never coerced", () => {
    const line = {
      impacts: { mobile: "patch" as const },
      memberVersions: { mobile: "0.21.3", web: "1.0.0" },
      mode: "catch-up" as const,
      train: "mobile",
    };

    expect(directionRefusal({ ...line, direction: "1.0.0" })).toBeNull();
    expect(directionRefusal({ ...line, direction: "1.0.1" })).toBeNull();
    expect(directionRefusal({ ...line, direction: "0.22.0" })).toEqual({
      evidence: ["mode catch-up selects 1.0.0"],
      reasonCode: "invalid-version-direction",
      requiredAction: "choose-version",
    });
    expect(directionRefusal({ ...line, direction: "0.21.3" })?.reasonCode).toBe(
      "invalid-version-direction"
    );
  });

  test("bump-shared direction must pass the head unless it joins its release set", () => {
    const line = {
      impacts: { mobile: "patch" as const, web: "patch" as const },
      memberVersions: { mobile: "0.21.0", web: "0.21.1" },
      mode: "bump-shared" as const,
    };

    expect(
      directionRefusal({ ...line, direction: "0.21.1", train: "mobile" })
    ).not.toBeNull();
    expect(
      directionRefusal({ ...line, direction: "0.21.2", train: "mobile" })
    ).toBeNull();
    // After mobile shipped 0.21.2 in the set, web may still take that number.
    expect(
      directionRefusal({
        ...line,
        direction: "0.21.2",
        memberVersions: { mobile: "0.21.2", web: "0.21.1" },
        setNumber: "0.21.2",
        train: "web",
      })
    ).toBeNull();
    expect(
      directionRefusal({
        ...line,
        direction: "0.21.3",
        setNumber: "0.21.2",
        train: "web",
      })?.evidence
    ).toEqual(["mode bump-shared selects 0.21.2"]);
  });

  test("bump-shared finalization fails when another member already released the number", () => {
    expect(
      bumpSharedCollision({
        releasedVersions: { mobile: ["0.21.0"], web: ["0.21.1", "0.21.2"] },
        releaseSet: ["mobile"],
        selected: "0.21.2",
      })
    ).toEqual({
      evidence: ["0.21.2 already released by web"],
      reasonCode: "final-verification-failed",
      requiredAction: "review-finalization",
    });
    expect(
      bumpSharedCollision({
        releasedVersions: { mobile: ["0.21.2"], web: ["0.21.2"] },
        releaseSet: ["mobile", "web"],
        selected: "0.21.2",
      })
    ).toBeNull();
  });
});

describe("shared version line ordering", () => {
  test("orders one to three numeric parts zero-padded and ignores build metadata", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.0")).toBe(0);
    expect(compareVersions("1.2.0+45", "1.2.0")).toBe(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(nextVersion("1.2", "patch")).toBe("1.2.1");
    expect(nextVersion("1.2", "minor")).toBe("1.3.0");
  });

  test("two-part mobile versions share the head with three-part ones", () => {
    const equal = released({
      impacts: { ios: "patch" },
      memberVersions: { ios: "1.2", web: "1.2.0" },
      mode: "catch-up",
    });
    const behind = released({
      impacts: { android: "patch" },
      memberVersions: { android: "1.1", web: "1.2" },
      mode: "catch-up",
    });

    expect(equal.decision.sharedVersionTrains).toEqual(["ios", "web"]);
    expect(equal.selected).toBe("1.2.1");
    expect(equal.decision.outcome).toBe("advance");
    expect(behind.selected).toBe("1.2");
    expect(behind.decision.outcome).toBe("catch-up");
  });

  test("excludes prereleases and blocks non-numeric or date-only versions", () => {
    expect(latestStableVersion(["1.0.0-rc.1", "0.21.3", "0.21.10"])).toBe(
      "0.21.10"
    );
    expect(isOrderableVersion("1.2")).toBe(true);
    expect(isOrderableVersion("1.0.0-rc.1")).toBe(true);
    expect(isOrderableVersion("2026-10-01")).toBe(false);
    expect(isOrderableVersion("latest")).toBe(false);
    expect(() => compareVersions("1.x", "1.0")).toThrow("non-numeric");
    expect(() =>
      selectLineVersion({
        impacts: { mobile: "patch" },
        memberVersions: { mobile: "0.21.0", web: "2026-10-01" },
        mode: "catch-up",
      })
    ).toThrow("non-numeric");
    expect(() =>
      selectLineVersion({
        impacts: { mobile: "patch" },
        memberVersions: { mobile: "0.21.0", web: "1.0.0-rc.1" },
        mode: "catch-up",
      })
    ).toThrow("Prereleases");
  });
});

describe("shared version line guidance", () => {
  test("states the wording, approval, and full-only boundaries", async () => {
    const [majorReleases, setup, onboarding] = await Promise.all(
      ["major-releases.md", "setup.md", "onboarding.md"].map((name) =>
        readFile(join(REFERENCES, name), "utf8")
      )
    );
    const prose = collapse(reference);

    for (const rule of [
      "Apply the mode silently",
      "Mobile ships as 1.0 to match Web.",
      "Wording follows the train's own impact, not the number",
      "**Bug Fixes & Improvements**",
      "no major synthesis, name, or launch copy",
      "always asks",
      "`invalid-version-direction` and `choose-version`",
      "`final-verification-failed` and `review-finalization`",
      "zero-padded (`1.2` equals `1.2.0`)",
      "date-only headings",
      "Never ask the owner to name trains",
      "Should your apps share version numbers?",
      "**Separate numbers per app**",
      "**Same number everywhere**",
      "**One shared counter**",
      "desktop release-note destinations",
    ]) {
      expect(prose).toContain(rule);
    }
    const userFacing = prose
      .slice(prose.indexOf("Ask once,"), prose.indexOf("Mark option 2"))
      .replace(SAVED_VALUE, "");
    expect(userFacing).toContain(
      "Web ships 1.0, so the next Mobile release is 1.0"
    );
    for (const internal of ["catch-up", "bump-shared", "train"]) {
      expect(userFacing).not.toContain(internal);
    }
    expect(collapse(majorReleases ?? "")).toContain(
      "Catching up to a shared version line never finalizes a stable major"
    );
    expect(setup).toContain("`sharedVersionLines` is optional, full-only");
    expect(onboarding).toContain("## Shared version numbers");
  });
});
