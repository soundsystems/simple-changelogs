// Maintainer-side reference model of skills/simple-changelogs/references/
// shared-version-lines.md. Agents apply the guidance; this module pins its
// arithmetic so tests can check every worked example and invariant. It is not
// installed with any distribution.

import type { SharedVersionLineMode } from "./types.ts";

export type Impact = "none" | "patch" | "minor" | "major";
export type BumpLevel = Exclude<Impact, "none">;

// Field names and order match receipt v3's versionDecision.versionLine, so
// receipt v2 evidence maps onto it one to one.
export interface VersionLineDecision {
  members: string[];
  memberVersions: Record<string, string | null>;
  mode: SharedVersionLineMode;
  outcome: "catch-up" | "advance";
  sharedVersion: string | null;
  sharedVersionTrains: string[];
}

export interface TrainSelection {
  // Crossing a major boundary, 0.x to 1.0.0 included, always asks.
  forcesAsk: boolean;
  // The visible jump from the train's own version keys publicVersioning.
  policyLevel: BumpLevel;
  train: string;
  // Release-note wording follows the train's own impact, never the number.
  wordingImpact: BumpLevel;
}

export interface LineSelection {
  decision: VersionLineDecision;
  selected: string;
  trains: TrainSelection[];
}

export interface LineInput {
  // The normally chosen first number, used only when no member has a stable
  // public version yet.
  firstVersion?: string;
  // Every member's own impact for this release; omitted or "none" means the
  // train does not ship.
  impacts: Record<string, Impact>;
  // Latest stable public version per member, or null before its first one.
  memberVersions: Record<string, string | null>;
  mode: SharedVersionLineMode;
}

// Dotted numeric versions with one to three components, an optional
// prerelease that contains a letter (so a date such as 2026-10-01 is never
// read as 2026 plus a prerelease), and ignored +build metadata.
export const PUBLIC_VERSION =
  /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]*[A-Za-z][0-9A-Za-z.-]*))?(?:\+[0-9A-Za-z.-]+)?$/u;
const LEVELS: BumpLevel[] = ["patch", "minor", "major"];

type Triple = [number, number, number];

export const isOrderableVersion = (version: string): boolean =>
  PUBLIC_VERSION.test(version);

export const isStableVersion = (version: string): boolean =>
  PUBLIC_VERSION.exec(version)?.[4] === undefined &&
  PUBLIC_VERSION.test(version);

// Zero-pads missing components, so 1.2 orders equal to 1.2.0. A prerelease or
// a version with non-numeric parts is never ordered: it blocks instead.
const parse = (version: string): Triple => {
  const match = PUBLIC_VERSION.exec(version);
  if (!match) {
    throw new Error(`Cannot order non-numeric version: ${version}`);
  }
  if (match[4] !== undefined) {
    throw new Error(`Prereleases are excluded from a line: ${version}`);
  }
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

export const compareVersions = (left: string, right: string): number => {
  const a = parse(left);
  const b = parse(right);
  for (const index of [0, 1, 2] as const) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
};

export const nextVersion = (version: string, level: BumpLevel): string => {
  const [major, minor, patch] = parse(version);
  if (level === "major") {
    return `${major + 1}.0.0`;
  }
  if (level === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
};

// H ignores prereleases: only stable versions count.
export const latestStableVersion = (versions: string[]): string | null =>
  versions
    .filter(isStableVersion)
    .reduce<string | null>(
      (highest, version) =>
        highest === null || compareVersions(version, highest) > 0
          ? version
          : highest,
      null
    );

const highestLevel = (levels: BumpLevel[]): BumpLevel =>
  LEVELS[Math.max(...levels.map((level) => LEVELS.indexOf(level)))] ?? "patch";

const jumpLevel = (from: string | null, to: string): BumpLevel => {
  const [fromMajor, fromMinor] = parse(from ?? "0.0.0");
  const [toMajor, toMinor] = parse(to);
  if (toMajor !== fromMajor) {
    return "major";
  }
  return toMinor === fromMinor ? "patch" : "minor";
};

export const sharedVersionOf = (
  memberVersions: Record<string, string | null>
): { sharedVersion: string | null; sharedVersionTrains: string[] } => {
  const sharedVersion = latestStableVersion(
    Object.values(memberVersions).filter(
      (version): version is string => version !== null
    )
  );
  return {
    sharedVersion,
    sharedVersionTrains: Object.keys(memberVersions)
      .filter((train) => {
        const version = memberVersions[train] ?? null;
        return (
          version !== null &&
          sharedVersion !== null &&
          compareVersions(version, sharedVersion) === 0
        );
      })
      .sort(),
  };
};

/**
 * Selects one number for every shipping member of a line. Returns null when
 * no member has target-contained changes: a line never forces a release.
 */
export const selectLineVersion = (input: LineInput): LineSelection | null => {
  const members = Object.keys(input.memberVersions).sort();
  for (const version of Object.values(input.memberVersions)) {
    if (version !== null) {
      parse(version);
    }
  }
  for (const train of Object.keys(input.impacts)) {
    if (!members.includes(train)) {
      throw new Error(`${train} is not a member of this line`);
    }
  }
  const shipping = members.filter(
    (train) => (input.impacts[train] ?? "none") !== "none"
  );
  if (shipping.length === 0) {
    return null;
  }
  const own = (train: string): string | null =>
    input.memberVersions[train] ?? null;
  const impact = (train: string): BumpLevel =>
    input.impacts[train] as BumpLevel;
  const { sharedVersion, sharedVersionTrains } = sharedVersionOf(
    input.memberVersions
  );
  let selected: string;
  let outcome: VersionLineDecision["outcome"] = "advance";
  if (sharedVersion === null) {
    if (!input.firstVersion) {
      throw new Error("No member has a stable version; choose the first one");
    }
    selected = input.firstVersion;
  } else if (
    input.mode === "catch-up" &&
    shipping.every((train) => {
      const version = own(train);
      return (
        version === null ||
        (compareVersions(version, sharedVersion) < 0 &&
          compareVersions(nextVersion(version, impact(train)), sharedVersion) <=
            0)
      );
    })
  ) {
    selected = sharedVersion;
    outcome = "catch-up";
  } else {
    selected = nextVersion(sharedVersion, highestLevel(shipping.map(impact)));
  }
  return {
    decision: {
      members,
      memberVersions: Object.fromEntries(
        members.map((train) => [train, own(train)])
      ),
      mode: input.mode,
      outcome,
      sharedVersion,
      sharedVersionTrains,
    },
    selected,
    trains: shipping.map((train) => {
      const policyLevel = jumpLevel(own(train), selected);
      return {
        forcesAsk: parse(selected)[0] > parse(own(train) ?? "0.0.0")[0],
        policyLevel,
        train,
        wordingImpact: impact(train),
      };
    }),
  };
};

/** Formats the one evidence item a receipt v2 carries for a line decision. */
export const versionLineEvidence = (decision: VersionLineDecision): string =>
  `versionLine ${JSON.stringify({
    members: decision.members,
    memberVersions: decision.memberVersions,
    mode: decision.mode,
    outcome: decision.outcome,
    sharedVersion: decision.sharedVersion,
    sharedVersionTrains: decision.sharedVersionTrains,
  })}`;

/** Returns every violated invariant of a decision and its selected number. */
export const versionLineViolations = (
  decision: VersionLineDecision,
  selectedByTrain: Record<string, string>
): string[] => {
  const violations: string[] = [];
  const numbers = new Set(Object.values(selectedByTrain));
  if (numbers.size > 1) {
    violations.push("every train in one release set selects the same number");
  }
  const { sharedVersion } = decision;
  for (const [train, selected] of Object.entries(selectedByTrain)) {
    const own = decision.memberVersions[train] ?? null;
    if (own !== null && compareVersions(selected, own) <= 0) {
      violations.push(`${train} must exceed its own ${own}`);
    }
    if (decision.outcome === "catch-up") {
      if (selected !== sharedVersion) {
        violations.push(`${train} catch-up must select ${sharedVersion}`);
      }
      if (
        own !== null &&
        sharedVersion !== null &&
        compareVersions(own, sharedVersion) >= 0
      ) {
        violations.push(`${train} is not behind ${sharedVersion}`);
      }
    } else if (
      sharedVersion !== null &&
      compareVersions(selected, sharedVersion) <= 0
    ) {
      violations.push(`${train} advance must exceed ${sharedVersion}`);
    }
  }
  if (decision.mode === "bump-shared" && decision.outcome !== "advance") {
    violations.push("bump-shared always advances");
  }
  return violations;
};

export interface Refusal {
  evidence: string[];
  reasonCode: "final-verification-failed" | "invalid-version-direction";
  requiredAction: "choose-version" | "review-finalization";
}

/**
 * Validates exact current direction for one train without coercing it. The
 * second train of a release set passes the number its set already selected,
 * which it must repeat as the identical string.
 */
export const directionRefusal = (
  input: LineInput & { direction: string; setNumber?: string; train: string }
): Refusal | null => {
  const own = input.memberVersions[input.train] ?? null;
  const { sharedVersion } = sharedVersionOf(input.memberVersions);
  // memberVersions are read at the set's shared input target revision, so a
  // member holding H released it before this set: bump-shared never reuses H.
  const refused = (version: string): boolean =>
    (own !== null && compareVersions(version, own) <= 0) ||
    (sharedVersion !== null &&
      compareVersions(version, sharedVersion) <
        (input.mode === "bump-shared" ? 1 : 0));
  const offSet =
    input.setNumber !== undefined && input.direction !== input.setNumber;
  if (!(refused(input.direction) || offSet)) {
    return null;
  }
  const suggestion =
    input.setNumber !== undefined && !refused(input.setNumber)
      ? input.setNumber
      : selectLineVersion(input)?.selected;
  return {
    evidence: [`mode ${input.mode} selects ${suggestion ?? "none"}`],
    reasonCode: "invalid-version-direction",
    requiredAction: "choose-version",
  };
};

/**
 * Under bump-shared, finalization fails when another member outside the
 * release set already released the selected number.
 */
export const bumpSharedCollision = (input: {
  releaseSet: string[];
  releasedVersions: Record<string, string[]>;
  selected: string;
}): Refusal | null => {
  const colliding = Object.entries(input.releasedVersions)
    .filter(
      ([train, versions]) =>
        !input.releaseSet.includes(train) && versions.includes(input.selected)
    )
    .map(([train]) => train)
    .sort();
  return colliding.length === 0
    ? null
    : {
        evidence: [
          `${input.selected} already released by ${colliding.join(", ")}`,
        ],
        reasonCode: "final-verification-failed",
        requiredAction: "review-finalization",
      };
};
