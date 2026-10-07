# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain what changed before asking about a historical
audit. These entries do not themselves authorize released-history edits.
Guidance prompts stop repeating for a version once a disposition is recorded;
an unanswered prompt records nothing and may be asked again later.

## Guidance 1 to 15

Earlier checkpoints in brief; the Simple Changelogs `CHANGELOG.md` keeps their
full history.

| Guidance | What changed |
| --- | --- |
| 1 | Customer and developer changelogs, outcome-focused wording, `Unreleased` handling, and raw-Markdown attribution |
| 2 | Repository-local `.simple-changelogs.json` policy, one recorded audit disposition per guidance version, stored surface authorization, and portable signature comments |
| 3 | Stable-major release synthesis, separate from next-major prereleases |
| 4 | Durable UI polish may stay in `CHANGELOG.md` without reaching compact announcements |
| 5 | Expert public archives and per-destination scope maps |
| 6 | The mobile release-note placement choice for Web and Mobile products |
| 7 | Evidence-based component selection for authorized release-note surfaces |
| 8 | An optional changelog pointer in agent-instruction files |
| 9 | A production Web deployment is always a product release |
| 10 | Canonical history and selected product UI are separate editorial layers |
| 11 | Sparse strong emphasis for named product terms |
| 12 | Plain-language setup choices and `releaseNoteEnvironmentScope` |
| 13 | Version identifiers by role, and `crossSurfaceVersioning` |
| 14 | `releaseNoteLinks` for contextual actions |
| 15 | `publicVersioning` and digest-bound release receipts for Simple Changes |

<!-- simple-changelogs-guidance-update version="16" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 16

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.

<!-- simple-changelogs-guidance-update version="17" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Setup now inventories and verifies real product surfaces before saving destination choices, and full repositories can keep mobile history in app stores only." -->
## Guidance 17

First-use setup retains its plain-language primer, complete **Walk me through
it** path, and clear installed-guidance update choices, but now begins by
reporting the repository evidence it found for Web, Mobile, app-store, CMS,
workspace, and existing release-note destinations. It reuses established
surfaces; when none exists, it may recommend creating one but must ask before
the exact current surface. After destination types are selected, setup scans
again and explicitly confirms every existing, absent, or planned surface or
lets the owner choose again. A selection is never evidence that an underlying
product, route, authentication flow, credential, workspace, or monorepo exists.
Mobile placement now adds `store-only` as **App stores only**, distinct from
`mobile-only` as **Mobile app and stores — no Web history**; `web-tabs` and
`web-page` remain the tabbed and separate-page Web-and-Mobile choices. None of
these preferences authorizes creation of product UI or release-note surfaces,
and installed-guidance updates still leave saved settings and released history
unchanged while keeping historical review separate and conditional.

<!-- simple-changelogs-guidance-update version="18" kinds="behavior,onboarding" backfill="not-needed" summary="Recommended setup now uses progressive confirmation receipts, evidence-relevant questions, and separate source-revision and distribution-guidance identity." -->
## Guidance 18

Recommended setup now converts repository evidence into one plain-language
receipt and asks only for confirmation or changes. The guided path defines
technical terms when they first affect a decision and asks in dependency order,
from product shape and audiences through destinations and their details to
version behavior, storage, instruction pointers, and history handling.

Install and update reporting now separates the Git source revision, when known,
from the selected distribution's guidance checkpoint.

Confirmation receipts now show a compact consequential summary first with
**Confirm**, **Show details**, and **Change something**. The complete receipt
remains available, and details hidden by default cannot expand setup authority.

Inspection now reports scan completeness and marks each product surface as
`detected`, `not-detected`, or `uncertain`. Detailed Mobile and store questions
are suppressed only when a complete scan supports that conclusion. If topology
is uncertain, setup asks one combined confirmation instead of expanding every
possible product branch.

Web archive setup now asks two plain-language questions. **Should I build a
Release Notes page?** defines the page as the complete history of shipped
updates, offers a dedicated page, an existing page, or no page, and explains
that building it does not automatically show it live. **Who should see Release
Notes?** then maps developers, preview reviewers, and live visitors to the
environments where the page appears.

Public-version choices now explicitly include automatic patch selection while
minor and major releases still ask, with concrete SemVer examples for all three
levels. First-time setup defaults missing future release-note surfaces to
`ask` and waits for a real proposed surface before requesting authority;
advanced `allow` and `existing-only` policies remain available explicitly.
This prospective onboarding change rewrites no released history and grants no
surface, dependency, deployment, publication, store, or version authority.

<!-- simple-changelogs-guidance-update version="19" kinds="behavior,onboarding" backfill="not-needed" summary="Release notes now group related bullets by product area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
## Guidance 19

Release notes now group related changes under user-recognizable product areas by
default. Repeated areas merge into one category, important areas come first,
and sparse releases stay flat instead of creating one-bullet categories.

Onboarding now confirms whether stable major releases should receive a concise,
evidence-based name beside the canonical version. Minor releases require no
name. Patch releases always use one flat **Bug Fixes & Improvements** section.
Both preferences remain configurable and apply prospectively; released history
is unchanged and no release or publication authority is granted.

<!-- simple-changelogs-guidance-update version="20" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now lists releases, shows one release, filters entries, and lint-checks changelog structure. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
## Guidance 20

Repositories using this distribution gain a queryable history: agents and maintainers can answer history questions
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

<!-- simple-changelogs-guidance-update version="21" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
## Guidance 21

A reconciled release now keeps an empty `## Unreleased` heading in both
changelogs; removing it let the next merge prepend into the newest release.
`query.ts check` flags a duplicate or non-leading `Unreleased`. An optional
audit restores a missing empty heading and reports entries the newest release
absorbed; moving them needs separate authority.

<!-- simple-changelogs-guidance-update version="22" kinds="capability,onboarding" backfill="not-needed" summary="Apps that release separately can now share one version number, so an app that is behind catches up to the latest release number." -->
## Guidance 22

Separately versioned apps, such as Web, iOS, Android, or desktop, can share
one number through `sharedVersionLines`: under `catch-up`, Web `1.0.0` makes
Mobile's next release `1.0.0`; under `bump-shared`, every release takes the
next number. Notes still follow each app's own impact. Where two or more such
apps have no recorded answer, this update asks **Should your apps share
version numbers?** once. Nothing is renumbered and no backfill is needed.

<!-- simple-changelogs-guidance-update version="23" kinds="behavior" backfill="not-needed" summary="New changelog entries and release-note lines now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
## Guidance 23

New changelog entries and release-note lines use commas, colons, periods, or
parentheses instead of em-dashes; a sentence that would reach for one is
rewritten rather than having the character swapped. A repository's documented
house style still takes precedence. Setup and update questions now present each
choice as `**Choice (Recommended)**: consequence`, with the choices and their
defaults unchanged. Released entries keep their wording; no backfill is needed.

<!-- simple-changelogs-guidance-update version="24" kinds="behavior" backfill="not-needed" summary="Mobile test builds now include saved reusable tester instructions, and production App Store and Google Play notes have explicit field, locale, length, and publication rules; new or edited notes use no em dashes unless explicitly requested." -->
## Guidance 24

The agent finalizing a mobile beta or test build now prepares practical tester
instructions immediately and saves them with the exact build. Release owners
can refine or append those notes; a new build receives its own record carrying
forward relevant unresolved regression checks. TestFlight copy binds to the
app/build/locale, while Android copy binds to package/versionCodes/track/language.
The full checklist retains actions; compact Play copy describes changed flows.
TestFlight copy must fit its destination's limit and is required for external
testing; a record never overwrites another artifact's.

Production storefront guidance separately covers App Store What's New metadata
for the exact app/version/platform/locale, localizable and required after the
first version within 4,000 characters, and Play production-track release notes
within 500 Unicode characters per language. Plain paragraphs or simple bullets
are house style, not a vendor template. Tester steps are never promoted verbatim.

New or edited release notes and changelog entries across every destination use
no em dashes unless the user explicitly requests them. Repository house style
does not override this rule. Rewrite the sentence with appropriate punctuation.

Preparation remains separate from remote publication. Authorized writes need
credentials, an editable destination in its current review state, and exact
text/status readback. Current platform source tables and validation own limits.
This update grants no build, upload, submission, promotion, or messaging
authority. It asks no new policy questions, changes no saved settings, and
rewrites no released history.

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
releases untagged. Every Simple Changelogs distribution now shares this
guidance number. No backfill is needed.
