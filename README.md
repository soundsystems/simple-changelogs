# Simple Changelogs

[![skills.sh](https://skills.sh/b/soundsystems/simple-changelogs)](https://skills.sh/soundsystems/simple-changelogs)

Simple Changelogs is an agent-neutral family of release-history skills. Choose
one changelog-owning distribution for a repository so agents load only the
audiences and release surfaces that exist there.

## Distributions

The Skills CLI reads each directory's `SKILL.md` name and description when it
lists choices. The table below provides the same selection guide.

| Skill | Use it for | Does not own |
| --- | --- | --- |
| `simple-changelogs` | Full cross-surface repositories: customer and developer histories, web, mobile, store, internal, versions, majors, and prereleases | A narrower distro selected by the repository |
| `simple-changelogs-cms` | One structured `CMS_CHANGELOG.json` rendered only for authenticated CMS operators; takes an entry-only release handoff | Public or developer changelogs, versions, tags, and public notes |
| `simple-changelogs-web` | Customer and optional developer histories plus established public web release-note destinations | Mobile/store and CMS operator history |
| `simple-changelogs-mobile` | Customer and optional developer histories plus mobile in-app and existing store-note metadata | Web and CMS operator destinations |
| `simple-changelogs-web-cms` | Public web history and a separate authenticated CMS operator history in one repository | Mobile/store destinations |
| `simple-changelogs-skill-maintainer` | Skill-development repositories: changelogs, packaged notes, guidance versions, fork provenance, and installable package boundaries | Product-app, CMS, mobile, and store workflows |

`publish-skill` is separate production tooling for synchronizing a
canonical skill through maintained forks and a real Skills CLI consumer
installation. It does not claim changelog ownership and may be installed beside
one distribution.

The distributions live in one repository because Skills CLI selects
self-contained skill directories. Separate repositories are unnecessary unless
a distribution later needs independent ownership, versioning, or release
cadence.

### Guidance versions are distribution-specific

The integer in each distribution's `SKILL.md` is a behavior checkpoint for that
distribution. It is not a Simple Changelogs family release, package version, or
claim that one distribution contains the others. Different numbers are
expected because each distribution changes only when its own behavior changes.

[`distribution-manifest.json`](distribution-manifest.json) lists the current
guidance checkpoint for every sibling distribution and is verified against the
installable `SKILL.md` files. The Git ref or commit identifies the shared source
revision. Report an installation with both identities, substituting the
selected distribution's current checkpoint from the manifest for `<N>`:

```text
Installed Simple Changelogs from <git-ref-or-commit>.
Selected simple-changelogs-skill-maintainer (guidance <N>) for this repository.
```

Do not shorten that to “Simple Changelogs `<N>`.”

## Release-note depth and surface isolation

Public notes adapt to their proven audience. General customer destinations keep
outcome-focused detail, while established expert archives may retain public API,
CLI, SDK, plug-in, device, compatibility, debugging, and comprehensive patch
information that power users or integrators need. Long-form archives can use
named feature narratives, existing approved media, stable product-area
groupings, and an audience-relevant fix ledger without exposing private
developer history.

Long pages may add an anchor-linked feature index so the narrative remains
scannable.

In a monorepo, each destination gets an independent scope map. Web, mobile,
store, CMS, package, and internal notes may share a version while rendering
different eligible outcomes. Shared changes appear in more than one destination
only when evidence proves that each audience is affected; positive and negative
selector checks prevent unrelated platform or role details from leaking across
surfaces.

One repository and one canonical customer history can also contain several
independent release trains. A monorepo proves shared source ownership, not a
shared release version, so different products may sit on different public
versions without that being drift:

```text
Mobile public version: 3.2.0     iOS build number:     1842
Web public version:    6.7.0     Android version code: 1842
Development version:   3.2.0-rc.4+abc123
```

Build numbers and development identifiers are linked release evidence, never
alternate public versions and never a reason to bump one. Optional
`crossSurfaceVersioning` records whether surfaces are `shared`, `independent`,
or `mixed`; when several public version owners exist and the relationship stays
ambiguous, the skill asks once, records the answer, and leaves version fields
untouched until then.

For the full distribution, setup asks where people should read mobile-specific
history. The owner chooses **App stores only**, **Mobile app and app stores —
no Web**, **Web and mobile — one tabbed Release Notes page**, or **Web and
mobile — separate Release Notes pages**. Store-only prepares concise storefront
copy without adding an in-app history; the other choices retain established
in-app and store destinations. The feeds still come from one canonical item set
with explicit surface selectors, and shared outcomes remain visible to every
product they affect.
The repository policy stores that choice as `mobileReleaseNotePlacement` with
value `store-only`, `mobile-only`, `web-tabs`, or `web-page`.

Surface onboarding scans before it proposes. It reports existing release-note
destinations separately from Web, Mobile, store-metadata, CMS, and workspace
structure evidence; reuses established eligible destinations; and recommends a
specific new destination only when none exists. If the requested product shape
is not present, setup asks whether it is a planned surface or whether the owner
wants to choose again. A planned choice never invents an app root, CMS route,
authentication boundary, store credential, or monorepo layout.

### Curated release notes

Repositories that record `publicReleaseNotes: "curated"` add a derived public
layer: `RELEASE_NOTES.md` at the repository root, generated from the customer
changelog at each release boundary. It selects highlights, rewrites headlines,
and rolls the remainder into one line; it is never authored directly and never
introduces facts the changelog does not contain. Each curated section carries a
provenance comment accounting every changelog entry as highlighted, rolled up,
or omitted, and `query.ts check` verifies that coverage mechanically —
Breaking and Security entries can never be filtered out. Each distribution's
`references/curation.md` documents the conventions.

## Install

List names and discovery descriptions without installing:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --list
```

Install one changelog distribution interactively:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs
```

Examples for every narrower distribution:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs-cms
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs-web
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs-mobile
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs-web-cms
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs-skill-maintainer
```

For a non-interactive project install to every detected agent:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs \
  --skill simple-changelogs-web \
  --agent '*' \
  -y
```

Add `-g` for a global install. Use `pnpx` instead of `bunx` if preferred. Agent
targets can be explicit:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent claude-code -g -y
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent cursor -g -y
```

Install a branch or tag with an explicit Git ref:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs.git#<branch-or-tag> \
  --skill simple-changelogs
```

Install the non-owning fork publication workflow independently or alongside the
selected distro:

```sh
bunx skills add https://gitlab.com/soundsystems/simple-changelogs \
  --skill publish-skill
```

Install `publish-skill` project-locally from this repository. Other skill
families may ship their own adaptation under the same name; the copy selected
from the repository being published is authoritative for that production run.

Do not install both `simple-changelogs-web` and `simple-changelogs-cms` to model
one repository. Select `simple-changelogs-web-cms`; it owns the combined policy
and prevents duplicate classification or writes.

## Distribution selection in a repository

The Markdown-based distributions use `.simple-changelogs.json`. New policies
record one of:

```json
{
  "schemaVersion": 1,
  "distribution": "web",
  "guidance": {
    "version": 13,
    "backfillStatus": "completed"
  },
  "developerChangelog": "required",
  "releaseNoteGrouping": "product-areas",
  "majorReleaseNaming": "named",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask",
  "crossSurfaceVersioning": "independent",
  "releaseNoteEnvironmentScope": "non-production",
  "releaseNoteLinks": "when-useful"
}
```

Allowed `distribution` values are `full`, `web`, `mobile`, `web-cms`, and
`skill-repository`. Each value selects one skill directory:

| `distribution` value | Skill directory |
| --- | --- |
| `full` | `skills/simple-changelogs` |
| `web` | `skills/simple-changelogs-web` |
| `mobile` | `skills/simple-changelogs-mobile` |
| `web-cms` | `skills/simple-changelogs-web-cms` |
| `skill-repository` | `skills/simple-changelogs-skill-maintainer` |

Existing policies without the field remain backward
compatible with the full distribution unless the repository explicitly selects
another one.

CMS-only uses `.simple-changelogs-cms.json` and a validated
`CMS_CHANGELOG.json`. The combined web+CMS distribution uses both the standard
policy and the CMS policy because their sources and audiences remain separate.

`simple-changelogs-cms` ships a `changelog-provider.json` (distribution
`cms`) that advertises the same request and receipt versions and schema
digests as the other distributions, without the public-version features. Its
handoff is entry-only: Simple Changes delegates on the `none` boundary and the
`cms-operators` train, `prepare` writes the operator entry into
`CMS_CHANGELOG.json`, and `verify` proves the entry is in the finalized
target. No phase selects a version, creates a tag, or produces a public note;
see `skills/simple-changelogs-cms/references/release-handoff.md`.

For an approved public Web archive, `releaseNoteEnvironmentScope` can expose
the complete surface in `all-environments`, `non-production`,
`production-only`, or `disabled`. The gate includes the route or page,
navigation and manual links, compact summaries, and automatic modals. Local and
preview only (`non-production`) is recommended for marketing and client sites:
production does not serve the route or expose an entry point, while development
and recognized previews keep it available. Generation, archive-data sync,
deployment, and publication remain separate decisions.

Product distributions may also record `releaseNoteLinks` as `when-useful`
(recommended), `ask`, or `disabled`. This controls contextual actions from an
individual release item to a verified app route or screen; it does not disable
summary-to-archive navigation. The setting is repository-only, and every target
must ship in the same release and match audience, permission, feature-flag,
platform, and environment eligibility.

Public-history distributions record `releaseNoteGrouping` as `product-areas`
(the default) or `flat`, and `majorReleaseNaming` as `named` (the default) or
`version-only`. Product-area grouping merges repeated user-recognizable areas
and avoids one-bullet categories. Stable majors may receive a reviewed
descriptive title beside the canonical version. Minor releases require no
title; patches use **Bug Fixes & Improvements** with a flat bullet list and no
second category layer. Both choices are portable onboarding preferences and
grant no version, publication, deployment, or store authority.
A sole repo-local distribution is selection evidence. A global installation is
only availability; it does not override a repo-local distro or explicit
repository instructions. When selection conflicts, agents stop before writing
instead of running two workflows.

## First-write onboarding

Every changelog distribution includes a deterministic, non-TTY
`scripts/setup.ts` helper. A write-capable task runs inspection before changing
history; read-only questions and previews pass `--task-mode read` and never
write policy.

```sh
bun skills/simple-changelogs-web/scripts/setup.ts inspect \
  --json \
  --task-mode write \
  --repo .
```

When policy is missing, the agent summarizes detected distribution, histories,
released headings, established destinations, and applicable global defaults.
It then offers recommended setup, customization, or run-only preferences as a
numbered, choose-one question. Every unresolved option explains the outcome,
user impact, saved change, and tradeoff; diagrams are included where audience,
environment, data flow, or write scope is easier to compare visually. Questions
are presented one at a time so production users receive the setup in digestible
pieces. The user confirms a plain-language receipt before durable writes, and
the agent continues the original changelog task after setup.

When released history exists, recommended onboarding includes an initial
backfill of the complete accessible history from the oldest trustworthy
evidence through setup. Large histories may be processed in reviewable batches,
but a recent window or representative sample cannot be recorded as completed.
The final onboarding question asks only whether to defer or decline that
default; confirming the receipt starts it without a separate approval.

```sh
bun skills/simple-changelogs-web/scripts/setup.ts apply \
  --developer-history required \
  --release-note-grouping product-areas \
  --major-release-naming named \
  --signatures agent-and-timestamp \
  --new-surfaces ask \
  --backfill not-applicable \
  --scope repository \
  --setup-style recommended \
  --confirm \
  --repo .
```

`--scope all-projects` saves a private solo-developer profile containing only
developer-history, release-note grouping, major-release naming, signature,
missing-surface, version-selection, and setup-style defaults.
Repository distribution, audiences, destinations, routes, authentication,
released-history state, metadata, and publication authority are always
rediscovered. Storage uses:

- macOS: `~/Library/Application Support/simple-changelogs/preferences.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/simple-changelogs/preferences.json`
- Windows: `%APPDATA%/simple-changelogs/preferences.json`

Set `SIMPLE_CHANGELOGS_CONFIG_DIR` to override the containing directory in
tests or automation. CMS-only and web+CMS application additionally require
`--cms-auth-proven`, `--cms-surface-proven`, and an exact `--cms-route`; the
helper never derives CMS access authority from global preferences.

### Query the history

The Markdown changelog distributions bundle a read-only `scripts/query.ts`
helper so agents and humans can treat the raw files as a queryable source of
truth. It never writes, caches, or indexes anything:

```sh
bun skills/simple-changelogs-web/scripts/query.ts releases --repo .
bun skills/simple-changelogs-web/scripts/query.ts show unreleased --log customer --repo .
bun skills/simple-changelogs-web/scripts/query.ts entries --since 2026-07-01 --grep "release" --repo . --json
bun skills/simple-changelogs-web/scripts/query.ts show 2.1.0 --log customer --omitted --repo .
```

`check` lints structure (unrecognized release headings, malformed signature
comments, parser diagnostics) and exits nonzero on problems so it can join
verification checklists. Both the canonical
`<!-- simple-changelogs-signature ... -->` comment and the older
`<!-- Agent: ... -->` dialect are recognized when attributing entries. In
curated repositories, `entries --ids` prints the entry identities that
curation provenance comments reference, and `check` also verifies curation
coverage whenever `RELEASE_NOTES.md` exists. Each distribution's
`references/querying.md` documents the subcommands and filters.

## Manual install

Copy only the selected self-contained directory:

```sh
mkdir -p .agents/skills
cp -R skills/simple-changelogs-web .agents/skills/
```

Agent-specific destinations can be used when desired:

```sh
# Codex
mkdir -p ~/.codex/skills
cp -R skills/simple-changelogs-web ~/.codex/skills/

# Claude Code
mkdir -p ~/.claude/skills
cp -R skills/simple-changelogs-web ~/.claude/skills/

# Cursor
mkdir -p .cursor/skills
cp -R skills/simple-changelogs-web .cursor/skills/

# Hermes
mkdir -p ~/.hermes/skills
cp -R skills/simple-changelogs-web ~/.hermes/skills/

# Grok Build
mkdir -p ~/.grok/skills
cp -R skills/simple-changelogs-web ~/.grok/skills/
```

Each installed directory contains its runtime instructions, references, and
deterministic runtime helper when applicable. It does not contain the
repository's model adapters, fixtures, contributor tests, or eval protocol.

## Development

Requires Bun, Git, and a POSIX shell:

```sh
bun install
bun run typecheck
bun run lint
bun run test
bun run eval
```

`bun run eval` validates all selectable package boundaries, runs the full
distribution's deterministic contract suite, and validates the CMS fixture.
Every installed skill must contain exactly one root `SKILL.md`; the entire
`tooling/` tree must contain none.

The optional authenticated behavior harness remains repository-only:

```sh
bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/codex.ts

bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/claude.ts

bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/hermes.ts

bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/cursor.ts

bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/grok.ts
```

Adapters use existing local CLI authentication and never store keys:

```sh
codex login status
claude auth status
hermes status
cursor-agent status
grok version
```

Optional per-run model variables are
`SIMPLE_CHANGELOGS_CODEX_MODEL`,
`SIMPLE_CHANGELOGS_CLAUDE_MODEL`,
`SIMPLE_CHANGELOGS_HERMES_MODEL`,
`SIMPLE_CHANGELOGS_CURSOR_MODEL`, and
`SIMPLE_CHANGELOGS_GROK_MODEL`. Hermes also accepts
`SIMPLE_CHANGELOGS_HERMES_PROVIDER`.

The harness uses a provider-neutral JSON stdin/stdout contract. Bundled adapters
isolate temporary fixtures and keep the selected skill directory read-only.
See [tooling/simple-changelogs/EVAL.md](tooling/simple-changelogs/EVAL.md) for
commands, response schemas, isolation details, authentication, case filters,
and extension guidance.

## Forks

A repository-local fork can specialize audiences, commands, and release
surfaces while retaining a provenance pin:

```md
Forked from `simple-changelogs` @ `<short-sha>`. <project>-specific deltas:
<audiences, policy sources, release surfaces, commands, ...>
```

Run the checker from the selected installed distribution or canonical source:

```sh
skills/simple-changelogs/scripts/check-fork-sync.sh \
  path/to/fork/SKILL.md \
  /path/to/simple-changelogs \
  origin/main
```

Exit `0` means current, `1` behind, `2` invalid input, and `3` divergent.
Repo-local precedence is a documented convention, not a claim that every
runtime loader deduplicates automatically.

## Repository layout

- `skills/simple-changelogs/` — full cross-surface runtime distribution.
- `skills/simple-changelogs-cms/` — CMS-only runtime distribution and
  validator.
- `skills/simple-changelogs-web/` — web-only runtime distribution.
- `skills/simple-changelogs-mobile/` — mobile/store runtime distribution.
- `skills/simple-changelogs-web-cms/` — combined public-web and protected-CMS
  runtime distribution.
- `skills/simple-changelogs-skill-maintainer/` — lean distribution for repositories that develop or distribute skills.
- `skills/publish-skill/` — optional production propagation workflow.
- `tooling/simple-changelogs/` — full contract and behavior harness, fixtures,
  schemas, tests, and Codex, Claude Code, Hermes, Cursor, and Grok adapters.
- `tooling/simple-changelogs-cms/` — CMS fixtures and contributor tests.
- `tooling/distributions.check.ts` — installed package-shape and discovery
  boundary validator.
