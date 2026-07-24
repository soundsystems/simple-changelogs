import { describe, expect, test } from "bun:test";
import {
  extractCurationSource,
  fingerprintBytes,
  fingerprintSourceScope,
  resolveCurationScope,
} from "../lib/curation-source.ts";
import type { CurationScope, SourceBoundary } from "../lib/types.ts";

const boundary = (overrides: Partial<SourceBoundary> = {}): SourceBoundary => ({
  heading: "1.2.0 - 2026-06-01",
  occurrence: 1,
  sourcePath: "CHANGELOG.md",
  ...overrides,
});

function nth<T>(list: readonly T[], index: number): T {
  const value = list.at(index);
  if (value === undefined) {
    throw new Error(`Expected an element at index ${index}`);
  }
  return value;
}

describe("extractCurationSource", () => {
  test("nested children stay attached to their top-level bullet", () => {
    const source = extractCurationSource(
      [
        "## 1.2.0 - 2026-06-01",
        "",
        "- Added export formats",
        "  - CSV download",
        "  - PDF download",
        "- Fixed sync retries",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.items).toHaveLength(2);
    expect(nth(source.items, 0).displayText).toContain("PDF download");
    expect(source.diagnostics).toHaveLength(0);
  });

  test("recognizes standard release headings with dates", () => {
    const source = extractCurationSource(
      ["## 1.0.0 - 2026-01-15", "", "- Initial release"].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(1);
    expect(nth(source.releases, 0).boundary.heading).toBe("1.0.0 - 2026-01-15");
    expect(nth(source.releases, 0).boundary.version).toBe("1.0.0");
    expect(nth(source.releases, 0).boundary.date).toBe("2026-01-15");
  });

  test("recognizes an Unreleased pending section", () => {
    const source = extractCurationSource(
      ["## Unreleased", "", "- Work in progress"].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(1);
    expect(nth(source.releases, 0).boundary.heading).toBe("Unreleased");
    expect(nth(source.releases, 0).boundary.version).toBeUndefined();
  });

  test("recognizes SemVer with prerelease and build metadata", () => {
    const source = extractCurationSource(
      ["## 2.0.0-rc.1+build.5 - 2026-02-01", "", "- Release candidate"].join(
        "\n"
      ),
      "CHANGELOG.md"
    );
    expect(nth(source.releases, 0).boundary.version).toBe("2.0.0-rc.1+build.5");
  });

  test("recognizes PEP 440 style versions", () => {
    const source = extractCurationSource(
      ["## 1.2.0rc1 - 2026-02-02", "", "- Candidate build"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.releases, 0).boundary.version).toBe("1.2.0rc1");
  });

  test("recognizes date-only release headings", () => {
    const source = extractCurationSource(
      ["## 2026-03-04", "", "- Dated release"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.releases, 0).boundary.date).toBe("2026-03-04");
    expect(nth(source.releases, 0).boundary.version).toBeUndefined();
  });

  test("recognizes named releases with no version or date", () => {
    const source = extractCurationSource(
      ["## Spring Launch", "", "- Announcement"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.releases, 0).boundary.heading).toBe("Spring Launch");
    expect(nth(source.releases, 0).boundary.version).toBeUndefined();
    expect(nth(source.releases, 0).boundary.date).toBeUndefined();
  });

  test("assigns 1-based occurrence ordinals to repeated headings", () => {
    const source = extractCurationSource(
      [
        "## Unreleased",
        "",
        "- First pass",
        "",
        "## Unreleased",
        "",
        "- Second pass",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(2);
    expect(nth(source.releases, 0).boundary.occurrence).toBe(1);
    expect(nth(source.releases, 1).boundary.occurrence).toBe(2);
  });

  test("treats flat bullets as independent atomic items", () => {
    const source = extractCurationSource(
      ["## 1.0.0", "", "- One", "- Two", "- Three"].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.items).toHaveLength(3);
    expect(source.items.map((item) => item.displayText)).toEqual([
      "- One",
      "- Two",
      "- Three",
    ]);
  });

  test("records nested feature section headings as sectionIdentity", () => {
    const source = extractCurationSource(
      [
        "## 1.0.0",
        "",
        "### Added",
        "",
        "- New export button",
        "",
        "### Fixed",
        "",
        "- Crash on load",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.releases, 0).sections).toEqual(["Added", "Fixed"]);
    expect(nth(source.items, 0).sectionIdentity).not.toBe("");
    expect(nth(source.items, 0).sectionIdentity).not.toBe(
      nth(source.items, 1).sectionIdentity
    );
  });

  test("items directly under a release have empty sectionIdentity", () => {
    const source = extractCurationSource(
      ["## 1.0.0", "", "- Top level change"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.items, 0).sectionIdentity).toBe("");
  });

  test("ignores fake headings and bullets inside fenced code blocks", () => {
    const source = extractCurationSource(
      [
        "## 1.0.0",
        "",
        "- Real entry",
        "",
        "```",
        "## Not a release",
        "- not a bullet",
        "```",
        "",
        "## 2.0.0",
        "",
        "- Another real entry",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(2);
    expect(source.releases.map((release) => release.boundary.heading)).toEqual([
      "1.0.0",
      "2.0.0",
    ]);
    expect(source.items).toHaveLength(2);
  });

  test("strips simple-changelogs-signature comments from display and fingerprint text", () => {
    const source = extractCurationSource(
      [
        "## 1.0.0",
        "",
        "- Signed entry",
        "<!-- simple-changelogs-signature agent=claude ts=2026-01-01 -->",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.items, 0).displayText).not.toContain(
      "simple-changelogs-signature"
    );
    expect(nth(source.items, 0).normalizedText).not.toContain(
      "simple-changelogs-signature"
    );
  });

  test("does not treat headings inside plain HTML comments as structure", () => {
    const source = extractCurationSource(
      [
        "## 1.0.0",
        "",
        "- Real entry",
        "",
        "<!--",
        "## Hidden release",
        "- hidden bullet",
        "-->",
        "",
        "## 2.0.0",
        "",
        "- Second entry",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(2);
    expect(source.items).toHaveLength(2);
  });

  test("normalizes CRLF and trailing whitespace for identity", () => {
    const crlf = extractCurationSource(
      ["## 1.0.0", "", "- Trailing space entry   "].join("\r\n"),
      "CHANGELOG.md"
    );
    expect(nth(crlf.items, 0).normalizedText).not.toContain("\r");
    expect(nth(crlf.items, 0).normalizedText.endsWith(" ")).toBe(false);

    const lf = extractCurationSource(
      ["## 1.0.0", "", "- Trailing space entry"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(crlf.items, 0).itemId).toBe(nth(lf.items, 0).itemId);
  });

  test("preserves links and inline Markdown in display text", () => {
    const source = extractCurationSource(
      [
        "## 1.0.0",
        "",
        "- Fixed [the bug](https://example.com/issues/1) in `parser.ts`",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(source.items, 0).displayText).toContain(
      "[the bug](https://example.com/issues/1)"
    );
    expect(nth(source.items, 0).displayText).toContain("`parser.ts`");
  });

  test("reports a diagnostic for bullets before any release heading", () => {
    const source = extractCurationSource(
      ["- Orphan bullet before any release", "", "## 1.0.0", "", "- Real"].join(
        "\n"
      ),
      "CHANGELOG.md"
    );
    expect(source.diagnostics.length).toBeGreaterThan(0);
    expect(source.items).toHaveLength(1);
  });

  test("reports a diagnostic for a nested bullet with no preceding top-level bullet", () => {
    const source = extractCurationSource(
      ["## 1.0.0", "", "  - Indented bullet with no parent"].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.diagnostics.length).toBeGreaterThan(0);
  });

  test("records empty releases with no items", () => {
    const source = extractCurationSource(
      ["## 1.0.0", "", "## 2.0.0", "", "- Only this release has items"].join(
        "\n"
      ),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(2);
    expect(nth(source.releases, 0).itemIds).toHaveLength(0);
    expect(nth(source.releases, 1).itemIds).toHaveLength(1);
  });

  test("handles a source with no releases and no placeholder content", () => {
    const source = extractCurationSource(
      ["# Changelog", "", "Nothing here yet."].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.releases).toHaveLength(0);
    expect(source.items).toHaveLength(0);
  });

  test("is deterministic across repeated runs on identical input", () => {
    const markdown = [
      "## 1.2.0 - 2026-06-01",
      "",
      "- Added export formats",
      "  - CSV download",
      "- Fixed sync retries",
    ].join("\n");
    const first = extractCurationSource(markdown, "CHANGELOG.md");
    const second = extractCurationSource(markdown, "CHANGELOG.md");
    expect(first.items.map((item) => item.itemId)).toEqual(
      second.items.map((item) => item.itemId)
    );
  });

  test("changes item identity when the atomic entry text changes", () => {
    const before = extractCurationSource(
      ["## 1.0.0", "", "- Original wording"].join("\n"),
      "CHANGELOG.md"
    );
    const after = extractCurationSource(
      ["## 1.0.0", "", "- Changed wording"].join("\n"),
      "CHANGELOG.md"
    );
    expect(nth(before.items, 0).itemId).not.toBe(nth(after.items, 0).itemId);
  });
});

describe("resolveCurationScope", () => {
  const markdown = [
    "## 2.0.0 - 2026-05-01",
    "",
    "### Added",
    "",
    "- Feature two",
    "",
    "## 1.1.0 - 2026-03-01",
    "",
    "- Fix one",
    "",
    "## 1.0.0 - 2026-01-01",
    "",
    "- Initial release",
  ].join("\n");

  test("resolves full-history to every item in document order", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const result = resolveCurationScope(source, { kind: "full-history" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemIds).toEqual(source.items.map((item) => item.itemId));
    }
  });

  test("resolves a single release", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const scope: CurationScope = {
      kind: "release",
      release: boundary({
        date: "2026-03-01",
        heading: "1.1.0 - 2026-03-01",
        version: "1.1.0",
      }),
    };
    const result = resolveCurationScope(source, scope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemIds).toEqual(nth(source.releases, 1).itemIds);
    }
  });

  test("returns a diagnostic when a release boundary cannot be found", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const scope: CurationScope = {
      kind: "release",
      release: boundary({ heading: "9.9.9 - 2099-01-01" }),
    };
    const result = resolveCurationScope(source, scope);
    expect(result.ok).toBe(false);
  });

  test("resolves a release-range across inclusive boundaries", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const scope: CurationScope = {
      first: boundary({ heading: "2.0.0 - 2026-05-01" }),
      kind: "release-range",
      last: boundary({ heading: "1.1.0 - 2026-03-01" }),
    };
    const result = resolveCurationScope(source, scope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemIds).toEqual([
        ...nth(source.releases, 0).itemIds,
        ...nth(source.releases, 1).itemIds,
      ]);
    }
  });

  test("resolves a named section within a release", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const scope: CurationScope = {
      kind: "section",
      release: boundary({ heading: "2.0.0 - 2026-05-01" }),
      section: boundary({
        heading: "Added",
        occurrence: 1,
        sourcePath: "CHANGELOG.md",
      }),
    };
    const result = resolveCurationScope(source, scope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemIds).toHaveLength(1);
    }
  });

  test("resolves an explicit item-set when every itemId exists", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const someIds = [nth(source.items, 0).itemId, nth(source.items, 2).itemId];
    const result = resolveCurationScope(source, {
      itemIds: someIds,
      kind: "item-set",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemIds).toEqual(someIds);
    }
  });

  test("rejects an item-set containing an unknown itemId", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const result = resolveCurationScope(source, {
      itemIds: ["not-a-real-item-id"],
      kind: "item-set",
    });
    expect(result.ok).toBe(false);
  });
});

describe("fingerprintSourceScope and fingerprintBytes", () => {
  const markdown = ["## 1.0.0 - 2026-01-01", "", "- Initial release"].join(
    "\n"
  );

  test("fingerprintBytes is deterministic for identical input", () => {
    expect(fingerprintBytes("hello world")).toBe(
      fingerprintBytes("hello world")
    );
  });

  test("fingerprintBytes differs for different input", () => {
    expect(fingerprintBytes("hello world")).not.toBe(
      fingerprintBytes("hello!")
    );
  });

  test("fingerprintBytes accepts Uint8Array and string equivalently", () => {
    const text = "matching content";
    const bytes = new TextEncoder().encode(text);
    expect(fingerprintBytes(text)).toBe(fingerprintBytes(bytes));
  });

  test("fingerprintSourceScope is deterministic across repeated calls", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const scope: CurationScope = { kind: "full-history" };
    expect(fingerprintSourceScope(source, scope)).toBe(
      fingerprintSourceScope(source, scope)
    );
  });

  test("fingerprintSourceScope changes when the resolved item set changes", () => {
    const source = extractCurationSource(markdown, "CHANGELOG.md");
    const otherMarkdown = [
      "## 1.0.0 - 2026-01-01",
      "",
      "- Initial release",
      "",
      "## 2.0.0 - 2026-02-01",
      "",
      "- Second release",
    ].join("\n");
    const otherSource = extractCurationSource(otherMarkdown, "CHANGELOG.md");
    const scope: CurationScope = { kind: "full-history" };
    expect(fingerprintSourceScope(source, scope)).not.toBe(
      fingerprintSourceScope(otherSource, scope)
    );
  });
});
