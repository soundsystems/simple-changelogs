# Curated Release Notes

Use this reference only when repository policy records
`publicReleaseNotes: "curated"`. The default `"full"` policy has no curated
layer and nothing in this file applies.

## Derived, never authored

`RELEASE_NOTES.md` at the repository root is a curated public layer generated
from `CHANGELOG.md` at a release boundary. It selects, rewrites headlines, and
rolls up; it never introduces facts, entries, dates, or versions that the
changelog does not already contain. The changelog remains the only source of
truth, so anything left unadvertised can be synthesized later.

Generate the proposed section during release reconciliation and include it in
the existing release receipt. One confirmation covers the release and its
curated section; never add a separate curation prompt.

## Structure

- Headings mirror the changelog's release-heading conventions: same version
  and/or date form, and a named major keeps its name beside the version.
- Highlights are one-sentence bullets with no sub-bullets and no
  implementation detail, grouped per the repository's `releaseNoteGrouping`
  policy.
- One rollup line ends the section: it summarizes the remainder in plain
  language and points at the full changelog (for example, "Plus N smaller
  fixes and improvements — see CHANGELOG.md for the complete list.").

## Highlight budget

`curationBudget` bounds the highlight count per release; when absent, use 3 to
8. Patch and date-only releases may drop below the minimum, down to zero
highlights plus the rollup line, and no release needs more highlights than it
has entries. Do not pad a thin release to reach the minimum or silently exceed
the maximum; when a release genuinely warrants more, ask.

## Coverage and provenance

Every changelog entry in a curated release is accounted exactly once as
highlighted, rolled up, or omitted. Entries labeled Breaking or Security (such
as `**Breaking**:` on the entry or a nested bullet, in any case), or under a
group or section heading naming either, may never be omitted or rolled up;
they are always highlighted.

Each curated section carries one provenance comment:

```html
<!-- simple-changelogs-curation source="CHANGELOG.md" release="<heading>" highlighted="<id,...>" rolled-up="<id,...>" omitted="<id,...>" -->
```

Ids are the first 12 hex characters of the parser's per-entry identity. Under
a curated policy, `query.ts check` enforces these rules, the budget, and that
each comment matches its heading, names `CHANGELOG.md`, has one highlighted id
per highlight bullet, and binds a release no other section binds.

The repository signature policy applies to curated blocks exactly as to any
other contiguous raw-markdown block.

## Backfill

Generating curated sections for already-released history is a safe derived
operation. Offer it once when curation is first enabled and released history
exists; never run it automatically. A declined or deferred backfill leaves
older releases uncurated without blocking new curated sections.

## Surfaces

Curation adds no surface. Public highlight surfaces this distribution already
owns render the curated layer by default, full-history surfaces render the
changelog, and internal surfaces are unchanged. There is no per-destination
layer policy field; see `references/release-note-surfaces.md`.

## Non-goals

- No editing of `CHANGELOG.md` content: curation selects and rewrites
  presentation, never the canonical record.
- No new facts, screenshots, marketing claims, or dates.
- No configurable release-notes file path in this first cut.
- No change to the Simple Changes handoff protocol; curation is wholly inside
  changelog ownership.
- No automatic backfill and no separate confirmation flow.
