# Querying History

The bundled `scripts/query.ts` CLI answers questions about the raw Markdown
histories without writing anything. The Markdown files stay the source of
truth: there is no cache, index, or generated database to refresh.

Run this skill's own copy with Bun 1.3 or later from the repository root (or
pass `--repo PATH`). The paths below assume a repository-local install; for a
global install, run the installed copy by absolute path
(`bun /absolute/path/to/simple-changelogs-skill-maintainer/scripts/query.ts`):

```bash
bun skills/simple-changelogs-skill-maintainer/scripts/query.ts show 1.4 --log customer --json
bun skills/simple-changelogs-skill-maintainer/scripts/query.ts check
```

Subcommands:

- `releases`: one row per release section (heading, version, date, and entry
  count).
- `show <version|date|unreleased>`: every entry of one release. Bare versions
  resolve (`1.4` and `v1.4.0` match `1.4.0`); ambiguous selectors fail with
  the candidate list instead of guessing.
- `entries`: a flat entry list filtered by `--since`/`--until` (release date,
  falling back to the entry's signature timestamp for `Unreleased` work),
  `--group` for `- **Group**:` bullets, `--agent`, and `--grep`.
- `gaps [--since TAG] [--train NAME]`: merges on the first-parent line since a
  release tag whose diff adds no line to the selected changelogs. The default
  tag is the newest one reachable from `HEAD` that the `releaseTags` template
  names (`v{version}` when none is recorded); a per-train map needs `--train`
  unless it holds one template. It runs plain Git and writes nothing. A merge
  whose entry lives in another file is still listed, and integrations without
  a merge commit (squash, rebase, direct) are counted in a note, not checked.
- `check`: structure lint for unrecognized or ambiguous release headings,
  duplicate `Unreleased` headings, malformed signature comments, unclosed code
  fences or HTML comments, and unindented or ordered-list lines that are not
  entries. One empty `Unreleased` heading is valid; a missing or non-leading
  one is a note. Exits nonzero on problems; fix what it reports and rerun it
  until it exits 0. Legacy `<!-- Agent: ... -->` signatures are notes, not
  problems; they remain valid released history.

For curated release notes (see `references/curation.md`): `entries --ids`
prints each entry's 12-hex identity for provenance comments, `show <release>
--omitted` lists what a curated `RELEASE_NOTES.md` section omits or rolls up
(it always reads the customer changelog), and `check` verifies curation only
under `publicReleaseNotes: "curated"`; otherwise an existing
`RELEASE_NOTES.md` is a note.

Every subcommand accepts `--log customer|developer|both` (default `both`) and
`--json` for structured output whose fields (`date`, `version`, `title`,
`text`, `log`, `group`, `signature`) match the CMS entry vocabulary. Reads
target `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` at the repository root; a
missing developer changelog is an error only when requested explicitly or
required by recorded policy.
