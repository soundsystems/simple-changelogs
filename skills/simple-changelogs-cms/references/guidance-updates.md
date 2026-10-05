# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain material changes before asking about a historical
audit. These entries do not themselves authorize released-history edits.

## Guidance 1

Established one structured operator changelog, authenticated CMS presentation,
repository-local policy, and explicit historical-audit dispositions.

<!-- simple-changelogs-guidance-update version="2" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 2

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.

<!-- simple-changelogs-guidance-update version="3" kinds="capability,behavior,onboarding" backfill="not-needed" summary="CMS setup now verifies protected product structure and access evidence before reusing, proposing, or recording an operator destination as planned." -->
## Guidance 3

First-use setup now begins with a plain-language overview and offers **Walk me
through it**. The walkthrough explains the protected operator history, its
authenticated CMS destination, every unresolved preference, consequence,
recommended default, and authority boundary one question at a time.

Installed-guidance notices now lead with a clear headline and up to three
practical effects, confirm that saved settings and released history are
unchanged, and offer **Walk me through what changed — Recommended**, **Keep my
current settings and continue**, or **View detailed release notes**. Historical
review remains separate and conditional, and setup grants neither operator
access nor permission to create or expose a CMS surface.

CMS-only onboarding now reports discovered Web, Mobile, store, CMS, workspace,
and release-note evidence before confirming the operator-history destination.
It reuses an established authenticated CMS surface; if none exists, setup may
recommend one but must ask before the exact current surface, rescan, and obtain
confirmation or a revised choice. The selection cannot establish a CMS product,
route, authentication model, role, credential, or monorepo and grants neither
operator access nor surface-creation authority.

<!-- simple-changelogs-guidance-update version="4" kinds="behavior,onboarding" backfill="not-needed" summary="CMS setup now offers progressive confirmation receipts, evidence-gated operator questions, and separate source-revision and distribution-guidance identity." -->
## Guidance 4

Recommended CMS setup now turns protected-operator evidence into one
plain-language receipt and asks only for confirmation or changes. Guided setup
defines unfamiliar terms when they matter and asks about the operator
destination before its placement, access, or component details.

Install and update reporting now separates the Git source revision, when known,
from the selected distribution's guidance checkpoint.

Confirmation receipts now show a compact consequential summary first with
**Confirm**, **Show details**, and **Change something**. The complete receipt
remains available, and details hidden by default cannot expand setup authority.

Inspection now reports scan completeness and marks CMS and adjacent product
surfaces as detected, not detected, or uncertain. Detailed questions are
suppressed only when a complete scan supports the exclusion; uncertain topology
produces one combined confirmation.

Ordinary first-time setup records `ask` for future missing release-note UI and
waits until an exact protected surface is needed before requesting authority.
Advanced `allow` and `existing-only` policies remain supported explicitly. This
prospective change rewrites no released operator history and grants no surface,
operator access, dependency, deployment, or publication authority.

<!-- simple-changelogs-guidance-update version="5" kinds="capability,onboarding" backfill="optional" summary="CMS changelog entries may now carry curated highlights with a mechanical accounting of every underlying change." -->
## Guidance 5

A CMS changelog entry may now record curated highlights beside its complete
change list. `highlights` holds short advertised sentences derived from the
entry's changes, and an optional `curation` object accounts every change id as
highlighted, rolled up, or omitted so nothing silently disappears.

The bundled validator enforces the accounting when `curation` is present: every
change is accounted exactly once by its stable 12-hex id, unknown ids are
rejected, and a change beginning with `**Breaking**` or `**Security**` may
never be omitted or rolled up. Entries without these fields are unchanged, and
`highlights` may be used alone without the accounting object.

Existing released entries never gain highlights automatically. Backfilling
curation for already-released history is optional, offered once, and derives
only from the recorded changes.

<!-- simple-changelogs-guidance-update version="6" kinds="behavior" backfill="not-needed" summary="New CMS operator entries now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
## Guidance 6

New operator entries written into `CMS_CHANGELOG.json` use commas, colons,
periods, or parentheses instead of em-dashes; a sentence that would reach for
one is rewritten rather than having the character swapped. A repository's
documented house style still takes precedence. Setup and update questions now
present each choice as `**Choice (Recommended)**: consequence`, with the
choices and their defaults unchanged. Released entries keep their wording; no
backfill is needed.
