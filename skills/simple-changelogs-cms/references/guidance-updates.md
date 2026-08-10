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
