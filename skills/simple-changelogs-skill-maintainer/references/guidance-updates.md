# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain what changed before asking about a historical
audit. These entries do not themselves authorize released-history edits.

## Guidance 1

Established complementary customer and developer changelogs, outcome-focused
public wording, release-aware `Unreleased` handling, metadata alignment, and
nearby raw-markdown attribution.

Repositories with history predating this guidance could choose whether to
reconstruct or review that history. Prospective work followed the guidance even
when the historical review was declined or deferred.

## Guidance 2

Moved all durable decisions into the repository-local
`.simple-changelogs.json` policy. Installed packages no longer carry per-repo
state, so one installation can serve unrelated repositories safely.

Made initial setup require both changelog files and one recorded historical
audit disposition. Guidance prompts stop repeating for a version once a
disposition is recorded; an unanswered prompt records nothing and may be asked
again later. Unfinished or failed audits resume only when explicitly requested.

Added stored authorization for missing release-note destinations. Existing
destinations may stay synchronized during release work, while product UI and
internal operator surfaces require explicit current authority or documented
policy plus an authorized audience.

Replaced human-form attribution with a portable HTML comment whose identity and
timestamp may truthfully be `unreported`. Clarified that signatures are useful
metadata rather than proof of authorship or filesystem changes.

Corrected initial-development terminology: a `0.x.y` version is not inherently
a SemVer pre-release; suffixes such as `-beta` or `-rc.1` identify pre-releases.
Publicly distributed `0.x` products keep routine repair notes quiet while still
disclosing material trust, access, payment, safety, compliance, onboarding, or
data-loss outcomes.

Clarified that a local fork wins by repository convention, not through a
guaranteed loader capability, and bundled deterministic evaluation and fork
checking helpers with the installed package.

## Guidance 3

Added stable-major release synthesis. Version `1.0.0` now curates the durable
capabilities and stability promise established during public `0.x` development,
while later major releases explain the transition from the latest stable prior
line, including breaking changes and required migration.

Separated next-major development from stable-major finalization. Branch names
such as `v2` are supporting evidence only, and alpha, beta, or release-candidate
versions follow the repository's published version convention without being
mistaken for the stable major release. Public prerelease history remains intact
when the stable release is synthesized.

An approved historical audit may identify stable-major summaries that omit a
material migration or misstate the release boundary. Preserve released
headings and detailed history unless the audit separately authorizes a
meaning-changing correction under `references/backfill.md`.

## Guidance 4

Separated full customer history from compact release announcements. Durable,
identifiable UI and interaction polish may now remain in `CHANGELOG.md` even
when it is too minor for a What's New summary, store note, email, or other
highlight surface.

Incidental cosmetic churn, routine copy cleanup, and baseline corrections still
remain unrecorded by default. `DEVELOPER_CHANGELOG.md` receives polish only when
its implementation or tradeoffs create maintainable technical context; it is
not a catch-all UI ledger.

## Guidance 5

Onboarding now offers to add a short changelog pointer to an existing
agent-instruction file such as `AGENTS.md` or `CLAUDE.md`. The distribution
checkpoint already counted repository instructions among the signals selecting a
distribution, but no part of setup established that signal, so it had to be
written by hand.

The offer follows the preference scope already chosen. Repository scope targets
the repository's own instruction file; all-projects scope targets the user's
global instruction file, so a solo developer who keeps one file across projects
is asked once rather than once per repository; run-only scope writes nothing.

Every write requires explicit confirmation, since an agent-instruction file
governs agent behavior beyond changelog work, and the global file applies to
every repository on that machine. A global pointer therefore stays
distribution-neutral: it says a repository's own changelog skill owns the
decision and names no distribution, path, or repository, matching the constraint
already placed on global preferences.

It writes a pointer only: when the decision is due, the requirement to state the
outcome even when no entry is needed, and which skill owns the decision.
Classification, exclusions, and wording stay in the skill. A hand-written block
that restates them becomes a second copy that drifts independently and is read
on every turn, while the skill's own text is read only once an agent already
decided to open it.

Repositories that already carry such a block can have it replaced in place. An
existing pointer is updated rather than duplicated.

## Guidance 6

Setup now explains unresolved preferences as numbered, choose-one options with
diagrams where useful. Skill repositories record no product archive, compact
summary, component source, or `releaseNoteEnvironmentScope` value. This clarity
update rewrites no released notes and grants no product-surface, deployment, or
publication authority.

## Guidance 7

Added `publicVersioning` policy and digest-bound classify, prepare, and verify
handoffs for public skill-package releases. Missing policy asks for every
public bump with an exact suggestion. Version approval never grants package
publication, tagging, or hosted-release authority, and published history
remains unchanged.

<!-- simple-changelogs-guidance-update version="8" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 8

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.

<!-- simple-changelogs-guidance-update version="9" kinds="behavior,onboarding" backfill="not-needed" summary="First-use setup and guidance notices now fully explain skill-package histories, release decisions, defaults, and publication boundaries." -->
## Guidance 9

First-use setup now begins with a plain-language overview and offers **Walk me
through it**. The walkthrough explains customer and developer histories for
skill packages, applicable release workflows, unresolved preferences,
consequences, recommended defaults, and authority boundaries one question at a
time.

When newer guidance is detected, its notice now leads with a clear headline and
up to three practical effects, confirms that saved settings and released
history are unchanged, and offers **Walk me through what changed —
Recommended**, **Keep my current settings and continue**, or **View detailed
release notes**. Historical
review remains separate and conditional, and no setup choice grants tagging,
package publication, hosted-release, or downstream-distribution authority.

<!-- simple-changelogs-guidance-update version="10" kinds="behavior,onboarding" backfill="not-needed" summary="Skill-package setup now offers progressive confirmation receipts, explicit version choices, and separate source-revision and distribution-guidance identity." -->
## Guidance 10

Recommended skill-package setup now turns repository evidence into one
plain-language receipt and asks only for confirmation or changes. Guided setup
defines unfamiliar terms when they matter and asks in dependency order, ending
with instruction-pointer and released-history handling choices.

Install and update reporting now separates the Git source revision, when known,
from the selected distribution's guidance checkpoint.

Confirmation receipts now show a compact consequential summary first with
**Confirm**, **Show details**, and **Change something**. The complete receipt
remains available, and details hidden by default cannot expand setup authority.

Inspection reports scan completeness and detected, not-detected, or uncertain
surface applicability so unrelated product questions are omitted only when the
evidence supports that conclusion. Uncertain topology produces one combined
confirmation instead of every possible branch.

Version setup now distinguishes patch, minor, and major package releases with
concrete SemVer examples and explicitly offers automatic patches while minor
and major releases still ask. Ordinary first-time setup defaults future missing
release-note UI to `ask`; advanced `allow` and `existing-only` policies remain
supported when explicitly requested. This prospective change rewrites no
released history and grants no tagging, package publication, hosted-release,
downstream-distribution, UI, dependency, or version authority.

<!-- simple-changelogs-guidance-update version="11" kinds="behavior,onboarding" backfill="not-needed" summary="Skill release notes now group related bullets by skill area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
## Guidance 11

Skill-package release notes now group related changes under user-recognizable
skill areas by default, merge repeated areas, and keep sparse releases flat.
Onboarding confirms whether stable major releases should receive a concise,
evidence-based name beside the canonical version. Minor releases require no
name, and patches always use one flat **Bug Fixes & Improvements** section.
These preferences apply prospectively without rewriting released history or
granting tagging, publication, or downstream-distribution authority.

<!-- simple-changelogs-guidance-update version="12" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now inspects skill-repository releases, entries, and changelog structure without writing anything. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
## Guidance 12

Skill repositories gain a queryable history: agents and maintainers can answer history questions
directly from `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` with the bundled
`scripts/query.ts` helper. It lists release sections, shows one release by
version, date, or `Unreleased`, filters entries by date, group, agent, or
pattern, and lint-checks structure with a nonzero exit on problems. Bare
versions resolve to full ones, duplicate headings are disambiguated by
occurrence, and ambiguity produces a candidate list rather than a guess.

The helper also understands the legacy `<!-- Agent: ... -->` signature dialect
used before the canonical signature comment, so older attributed history stays
queryable. Legacy signatures are reported as notes during lint, never treated
as errors, and `references/querying.md` documents every subcommand.

This addition is read-only. It changes no saved settings, asks no new
onboarding questions, writes no cache or index beside the Markdown source of
truth, and gives released history no reason for a backfill.

Setup state recorded after onboarding — completing a partial released-history
audit, acknowledging a guidance update, or changing contextual preferences —
now writes through the same transaction-marked atomic path as initial
onboarding, and re-recording identical contextual preferences reports the
repository as already configured without rewriting stored policy.

Repositories with a public marketing or web surface may now opt into curated
public release notes. A new optional `publicReleaseNotes` repository policy
(`full` by default, `curated` on request) derives a `RELEASE_NOTES.md` at each
release boundary: a few one-sentence highlights within an optional
`curationBudget` (default 3-8) plus one rollup line pointing at the complete
changelog. The curated file is derived, never authored; every changelog entry
is mechanically accounted as highlighted, rolled up, or omitted, and breaking
changes and security notices are never omitted or rolled up. The proposed
section rides the existing release receipt, onboarding asks one evidence-led
question only when a public destination is detected, and repositories that
keep the default `full` policy see no change. Backfilling curated sections for
already-released history is a safe derived operation, offered once, never
automatic.

<!-- simple-changelogs-guidance-update version="13" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
## Guidance 13

A reconciled release now keeps an empty `## Unreleased` heading in both
changelogs; removing it let the next merge prepend into the newest release.
`query.ts check` flags a duplicate or non-leading `Unreleased`. An optional
audit restores a missing empty heading and reports entries the newest release
absorbed; moving them needs separate authority.

<!-- simple-changelogs-guidance-update version="14" kinds="behavior" backfill="not-needed" summary="New skill changelog entries and packaged release-note copy now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
## Guidance 14

New entries in the skill package's changelogs and its packaged release-note
copy use commas, colons, periods, or parentheses instead of em-dashes; a
sentence that would reach for one is rewritten rather than having the
character swapped. A repository's documented house style still takes
precedence. Setup and update questions now present each choice as
`**Choice (Recommended)**: consequence`, with the choices and their defaults
unchanged. Released entries keep their wording; no backfill is needed.

<!-- simple-changelogs-guidance-update version="15" kinds="behavior" backfill="not-needed" summary="New or edited release notes use no em dashes unless the user explicitly requests them; repository house style no longer supplies an exception." -->
## Guidance 15

Skill changelogs and packaged release-note copy now use no em dashes in new or
edited copy unless the user explicitly requests them. Rewrite the sentence with
commas, colons, periods, or parentheses as appropriate; do not merely swap the
character. Repository house style no longer supplies an exception. Released
history stays unchanged. This update asks no new policy questions and needs no
backfill.

<!-- simple-changelogs-guidance-update version="25" kinds="capability,onboarding" backfill="not-needed" summary="Each release can now get a Git tag: Simple Changelogs names it in the release receipt, and Simple Changes 0.27.0 or later creates and pushes it. This update asks once how releases should be tagged." -->
## Guidance 25

Each public release can now get a Git tag on its exact released commit. The
optional `releaseTags` setting picks the style: `"v{version}"`, another
`<prefix>{version}` template, one template per release train such as
`{"web": "web@{version}"}`, or `"none"`. Simple Changelogs names the tag in
receipt v4; Simple Changes 0.27.0 or later creates and pushes it when the
release goes out, under the approval that release already needs. Simple
Changelogs never creates or pushes tags, and earlier releases are never tagged.

This update asks **Should each release get a Git tag?** once, recommending the
repository's existing tag style when local tags show one, and no tags when
release tooling already creates them. No answer records nothing and leaves
releases untagged. This distribution moves from 15 to 25 because every Simple
Changelogs distribution now shares one guidance number. No backfill is needed.
