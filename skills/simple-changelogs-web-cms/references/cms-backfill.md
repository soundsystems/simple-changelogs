# Historical Backfill

A backfill reconstructs operator-relevant history from repository evidence; it
does not turn every commit into release copy.

## Authority

Start an initial backfill when the user confirms onboarding with its displayed
default, unless they defer or decline in the final question. Later audits still
require explicit current approval, recorded policy permission, or repository
instructions. Record `backfillStatus: "partial"` before editing and `completed`
only after the final history and route are verified.

## Evidence order

Prefer, in order:

1. signed or annotated release tags and hosted release metadata;
2. version files, release commits, and deployment records;
3. merge requests and first-parent merge history;
4. focused diffs and tests when subjects are ambiguous.

Use commit dates only as repository-history dates, not as unproven production
deployment dates. Omit a version when evidence does not establish one.

## Reconstruction

The initial backfill during adoption always covers the complete accessible
history, from the oldest trustworthy evidence through the setup boundary.
Cover that entire range while grouping small commits into meaningful operator
milestones. Account for every historical change; record why abandoned,
reverted, noisy, private, or unsupported candidates were omitted instead of
silently using a recent window, commit-count limit, highlight set, or
representative sample. Mark reconstructed entries with `kind: "backfill"` and
keep them newest-first.

Inspect changes rather than repeating vague subjects such as “fix,” “v1,” or
“maintenance.” If evidence cannot support a useful operator statement, leave
that candidate out and report the uncertainty.

## Verification

Review the oldest and newest evidence boundaries, validate dates and versions,
confirm every entry has a concrete operator consequence, and run the bundled
repository validator. Record the inspected range and any intentionally omitted
ambiguous periods in the handoff. Set `completed` only after every intervening
range and established mirror has been verified. Shallow history, missing
release records, or another evidence gap keeps the initial backfill `partial`
or `failed` until resolved.
