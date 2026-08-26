# Curated Release Notes (two-step UX log)

Decision record and implementation spec, approved 2026-08-25.

## Problem

`CHANGELOG.md` must stay complete (every durable user-visible change), which
makes it too dense to advertise. Editorial "is this worth advertising?"
judgment currently competes with factual "is this user-visible?" classification
at write time. Major releases already receive synthesis and patch releases
already collapse to **Bug Fixes & Improvements**; minor releases have no
curated form.

## Decision

Add a derived, curated public layer. Rules that keep downsides near zero:

1. **Derived, never authored.** `RELEASE_NOTES.md` is generated from the
   customer changelog at a release boundary. It selects, rewrites headlines,
   and rolls up; it never introduces facts. The changelog remains the only
   source of truth; anything unadvertised can be synthesized later from it.
2. **No new interruptions.** The proposed curated section rides the existing
   release receipt. Repositories with `publicReleaseNotes: "full"` (the
   default) see no change at all.
3. **Mechanical anti-drift.** Every changelog entry in a curated release must
   be accounted as highlighted, rolled up, or omitted. Breaking changes and
   security notices may never be omitted or rolled up. `query.ts check`
   enforces this.

## Conventions

- Policy: `publicReleaseNotes: "full" | "curated"` (default `"full"`),
  optional `curationBudget: { "min": 3, "max": 8 }` (defaults 3/8). Patch
  releases may drop below `min`, to zero highlights plus the rollup line.
- File: `RELEASE_NOTES.md` at the repository root. Headings mirror the
  changelog's release-heading conventions (version and/or date; a named major
  keeps its name beside the version). Highlights are one-sentence bullets, no
  sub-bullets, no implementation detail, grouped per `releaseNoteGrouping`.
  One rollup line summarizes the remainder and points at the full changelog.
- Provenance: each curated section carries
  `<!-- simple-changelogs-curation source="CHANGELOG.md" release="<heading>"
  highlighted="<id,...>" rolled-up="<id,...>" omitted="<id,...>" -->` where
  ids are the first 12 hex characters of the parser's per-entry identity.
  The repository signature policy applies to curated blocks as to any other
  contiguous raw-markdown block.
- Breaking/security detection: an entry whose text begins with `**Breaking**`
  or `**Security**`, or that belongs to a group of that name.
- CMS variant (first cut): the release object gains optional
  `highlights: string[]` and optional `curation` accounting object using
  existing entry ids; the validator enforces the same coverage and
  non-filterable rules when present.
- Surfaces: public marketing pages and release-note modals render the curated
  layer when `RELEASE_NOTES.md` exists; archive pages render the full
  changelog; internal surfaces are unchanged. Documented mapping only — no new
  per-destination policy field in the first cut.
- Backfill: generating curated sections for already-released history is a
  safe derived operation, offered once, never automatic.
- Guidance: folded into this branch's unreleased checkpoints (full 20, Web 19,
  Mobile 18, skill-maintainer 12, Web+CMS 19); CMS-only advances 4 → 5 and the
  Web+CMS CMS track advances 1 → 2.

## Out of scope (first cut)

Per-destination layer policy fields, configurable release-notes file paths,
and any change to the Simple Changes handoff protocol — curation is wholly
inside changelog ownership.
