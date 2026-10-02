# Querying History

The bundled `scripts/query.ts` CLI answers questions about the raw Markdown
histories without writing anything. The Markdown files stay the source of
truth: there is no cache, index, or generated database to refresh.

Run it with Bun 1.3 or later from the repository root (or pass
`--repo PATH`):

```bash
bun scripts/query.ts releases --log customer
bun scripts/query.ts show 1.4 --log customer --json
bun scripts/query.ts entries --since 2026-07-01 --grep "release notes"
bun scripts/query.ts check
```

Subcommands:

- `releases` — one row per release section: heading, version, date, and entry
  count.
- `show <version|date|unreleased>` — every entry of one release. Bare versions
  resolve (`1.4` matches `1.4.0`); ambiguous selectors fail with the candidate
  list instead of guessing.
- `entries` — a flat entry list filtered by `--since`/`--until` (release date,
  falling back to the entry's signature timestamp for `Unreleased` work),
  `--group` for `- **Group**:` bullets, `--agent`, and `--grep`.
- `check` — structure lint: unrecognized release headings, duplicate
  `Unreleased` headings, malformed signature comments, and parser diagnostics.
  One empty `Unreleased` heading is valid; a missing or non-leading one is a
  note. Exits nonzero on problems; fix what it reports and rerun it until it
  exits 0. Legacy `<!-- Agent: ... -->` signatures are reported as notes,
  not problems; they remain valid released history.

For curated release notes (see `references/curation.md`): `entries --ids`
prints each entry's 12-hex identity for use in curation provenance comments,
`show <release> --omitted` lists what a curated `RELEASE_NOTES.md` section
records as omitted or rolled up, and `check` verifies curation coverage
(every entry accounted exactly once, Breaking/Security never filtered, the
highlight budget respected) whenever `RELEASE_NOTES.md` exists.

Every subcommand accepts `--log customer|developer|both` (default `both`) and
`--json` for structured output whose fields (`date`, `version`, `title`,
`text`, `log`, `group`, `signature`) match the CMS entry vocabulary. Reads
target `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` at the repository root; a
missing developer changelog is an error only when requested explicitly or
required by recorded policy.
