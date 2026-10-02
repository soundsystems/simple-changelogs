import { describe, expect, test } from "bun:test";
import {
  classifyMarkdown,
  parseChangelog,
  parseReleaseNotes,
} from "../lib/changelog-parse.ts";
import { extractCurationSource } from "../lib/curation-source.ts";

const SIGNATURE =
  '<!-- simple-changelogs-signature agent="Test Agent" at="2026-09-01T10:00:00-05:00" -->';

const parse = (lines: string[]) =>
  parseChangelog(lines.join("\n"), "CHANGELOG.md");

const entriesOf = (parsed: ReturnType<typeof parse>) => {
  const [release] = parsed.releases;
  if (release === undefined) {
    throw new Error("Expected a release");
  }
  return release.entries;
};

const shape = (lines: string[]) =>
  parse(lines).releases.map((release) => ({
    heading: release.heading,
    titles: release.entries.map((entry) => entry.title),
  }));

describe("HTML comments never hide structure", () => {
  test("an inline comment keeps its bullet and strips from the title", () => {
    const parsed = parse([
      "## 1.5.0 - 2026-09-01",
      "",
      "- Added dark mode. <!-- reviewed -->",
      "- **Breaking**: Removed the v1 API <!-- see MR !42 -->",
    ]);
    expect(parsed.diagnostics).toEqual([]);
    const entries = entriesOf(parsed);
    expect(entries.map((entry) => entry.title)).toEqual([
      "Added dark mode.",
      "**Breaking**: Removed the v1 API",
    ]);
    // Entry text keeps the raw Markdown, so identities stay stable.
    expect(entries[0]?.text).toBe("- Added dark mode. <!-- reviewed -->");
  });

  test("a comment opener inside a code span is literal text", () => {
    expect(
      shape([
        "## Unreleased",
        "",
        "- Fixed rendering of `<!--` in templates.",
        SIGNATURE,
        "",
        "## 1.4.0 - 2026-05-01",
        "",
        "- Added the export planner",
        SIGNATURE,
      ])
    ).toEqual([
      {
        heading: "Unreleased",
        titles: ["Fixed rendering of `<!--` in templates."],
      },
      { heading: "1.4.0 - 2026-05-01", titles: ["Added the export planner"] },
    ]);
  });

  test("a heading with a trailing comment stays a release heading", () => {
    const parsed = parse([
      "## Unreleased",
      "",
      "## 1.5.0 - 2026-09-01 <!-- tag v1.5.0 -->",
      "",
      "- Shipped",
    ]);
    expect(parsed.releases.map((release) => release.heading)).toEqual([
      "Unreleased",
      "1.5.0 - 2026-09-01",
    ]);
    expect(parsed.releases[1]?.version).toBe("1.5.0");
    expect(parsed.releases[1]?.entries).toHaveLength(1);
  });

  test("a closed comment block hides the headings and bullets inside it", () => {
    expect(
      shape([
        "## 1.0.0 - 2026-01-01",
        "",
        "- Real entry",
        "",
        "<!--",
        "## 1.1.0 - 2026-02-01",
        "- Draft entry",
        "-->",
        "- Second real entry",
      ])
    ).toEqual([
      {
        heading: "1.0.0 - 2026-01-01",
        titles: ["Real entry", "Second real entry"],
      },
    ]);
  });

  test("an unclosed comment is a diagnostic and swallows nothing", () => {
    const parsed = parse([
      "## 1.5.0 - 2026-09-01",
      "",
      "<!-- TODO: finish the notes",
      "- Added exports",
      "",
      "## 1.4.0 - 2026-08-01",
      "",
      "- Added imports",
      SIGNATURE,
    ]);
    expect(parsed.releases.map((release) => release.entries.length)).toEqual([
      1, 1,
    ]);
    expect(parsed.diagnostics).toEqual([
      'Unclosed HTML comment at line 3 ("<!-- TODO: finish the notes"); later lines read as Markdown.',
    ]);
  });

  test("an unclosed inline comment is a diagnostic and stays literal", () => {
    const parsed = parse([
      "## 1.5.0 - 2026-09-01",
      "",
      "- Fixed rendering of <!-- in templates.",
      "",
      "## 1.4.0 - 2026-08-01",
      "",
      "- Added imports",
    ]);
    expect(parsed.releases).toHaveLength(2);
    expect(entriesOf(parsed)[0]?.title).toBe(
      "Fixed rendering of <!-- in templates."
    );
    expect(parsed.diagnostics).toHaveLength(1);
  });

  test("an inline comment may continue onto the next line of its paragraph", () => {
    const parsed = parse([
      "## 1.5.0 - 2026-09-01",
      "",
      "- Added exports <!-- reviewer:",
      "  QA team -->",
      "- Added imports",
    ]);
    expect(parsed.diagnostics).toEqual([]);
    expect(entriesOf(parsed).map((entry) => entry.title)).toEqual([
      "Added exports",
      "Added imports",
    ]);
  });

  test("curation-source shares the same comment handling", () => {
    const source = extractCurationSource(
      [
        "## 1.5.0 - 2026-09-01 <!-- tag -->",
        "",
        "- Added dark mode. <!-- reviewed -->",
        "- Fixed rendering of `<!--` in templates.",
        "",
        "## 1.4.0 - 2026-08-01",
        "",
        "- Added imports",
      ].join("\n"),
      "CHANGELOG.md"
    );
    expect(source.diagnostics).toEqual([]);
    expect(
      source.releases.map((release) => [
        release.boundary.heading,
        release.itemIds.length,
      ])
    ).toEqual([
      ["1.5.0 - 2026-09-01", 2],
      ["1.4.0 - 2026-08-01", 1],
    ]);
  });
});

describe("fenced code is inert at any indentation", () => {
  test("a top-level fence hides headings, bullets, and signatures", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "- Real entry",
      "",
      "```md",
      "## 2.0.0 - 2026-02-01",
      "- Fake entry",
      SIGNATURE,
      "```",
      "- Second real entry",
    ]);
    expect(parsed.releases).toHaveLength(1);
    expect(entriesOf(parsed).map((entry) => entry.title)).toEqual([
      "Real entry",
      "Second real entry",
    ]);
    expect(entriesOf(parsed)[0]?.signature).toBeNull();
  });

  test("a fence nested four spaces deep stays code inside its entry", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "- Documented signatures",
      "  - Example:",
      "",
      "    ```html",
      `    ${SIGNATURE}`,
      "    <!-- an unclosed example",
      "    ```",
      "- Second entry",
    ]);
    expect(parsed.diagnostics).toEqual([]);
    const [first, second] = entriesOf(parsed);
    expect(first?.signature).toBeNull();
    expect(first?.text).toContain(SIGNATURE);
    expect(second?.title).toBe("Second entry");
    expect(
      classifyMarkdown("    ```\n    ## x\n    ```").lines.map(
        (line) => line.kind
      )
    ).toEqual(["code", "code", "code"]);
  });

  test("an unclosed fence is a diagnostic", () => {
    const parsed = parse(["## 1.0.0 - 2026-01-01", "", "```", "- Entry"]);
    expect(parsed.diagnostics).toHaveLength(1);
    expect(entriesOf(parsed)).toHaveLength(1);
  });
});

describe("entry text and attribution", () => {
  test("signature-like text inside a code span is kept", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "- Documented the `<!-- Agent: NAME | MM/DD/YYYY ... -->` dialect.",
    ]);
    expect(entriesOf(parsed)[0]?.text).toContain(
      "`<!-- Agent: NAME | MM/DD/YYYY ... -->`"
    );
  });

  test("a subsection heading does not cut the signature block", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "- Above the subsection",
      "",
      "### Fixed",
      "",
      "- Below the subsection",
      SIGNATURE,
    ]);
    expect(entriesOf(parsed).map((entry) => entry.signature?.agent)).toEqual([
      "Test Agent",
      "Test Agent",
    ]);
  });

  test("a release heading does cut the signature block", () => {
    const parsed = parse([
      "## 1.1.0 - 2026-02-01",
      "",
      "- Unsigned",
      "",
      "## 1.0.0 - 2026-01-01",
      "",
      "- Signed",
      SIGNATURE,
    ]);
    expect(entriesOf(parsed)[0]?.signature).toBeNull();
  });

  test("entries record every enclosing section heading", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "### Security",
      "",
      "#### Fixed",
      "",
      "- Patched",
    ]);
    const [entry] = entriesOf(parsed);
    expect(entry?.section).toBe("Fixed");
    expect(entry?.sections).toEqual(["Security", "Fixed"]);
  });
});

describe("headings and lines that would need a guess", () => {
  test("text beside Unreleased reads as Unreleased with a diagnostic", () => {
    const parsed = parse(["## Unreleased (targeting 1.5.0)", "", "- Pending"]);
    expect(parsed.releases[0]?.unreleased).toBe(true);
    expect(parsed.releases[0]?.version).toBeNull();
    expect(parsed.diagnostics).toHaveLength(1);
  });

  test("a version inside prose after the date is not the release version", () => {
    const prose = parse([
      "## 2026-08-25 - hotfix for 3.2 clients",
      "",
      "- Fix",
    ]);
    expect(prose.releases[0]?.version).toBeNull();
    expect(prose.releases[0]?.date).toBe("2026-08-25");
    expect(prose.diagnostics).toHaveLength(1);

    const plain = parse(["## 2026-08-25 - v1.4.0", "", "- Fix"]);
    expect(plain.releases[0]?.version).toBe("1.4.0");
    expect(plain.diagnostics).toEqual([]);
  });

  test("lazy continuations and ordered-list items are diagnostics", () => {
    const parsed = parse([
      "## 1.0.0 - 2026-01-01",
      "",
      "- Added dark mode",
      "which works everywhere.",
      "",
      "1. Numbered item",
      "",
      "Closing prose after a blank line is fine.",
    ]);
    expect(parsed.diagnostics).toHaveLength(2);
    expect(entriesOf(parsed)).toHaveLength(1);
  });
});

describe("parseReleaseNotes", () => {
  test("ignores headings, bullets, and curation comments inside comment blocks", () => {
    const parsed = parseReleaseNotes(
      [
        "# Release Notes",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Highlight",
        "",
        "<!--",
        "## 0.9.0 - 2025-12-01",
        "- Draft highlight",
        '  simple-changelogs-curation source="CHANGELOG.md"',
        "-->",
      ].join("\n"),
      "RELEASE_NOTES.md"
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.highlights).toEqual(["Highlight"]);
  });
});
