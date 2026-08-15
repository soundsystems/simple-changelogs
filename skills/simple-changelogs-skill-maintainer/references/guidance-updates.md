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
