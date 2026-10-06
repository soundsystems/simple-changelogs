# Mobile Beta and Testing Notes

## Contents

- Ownership and timing
- Persist with the exact build
- Write a reusable full checklist
- iOS TestFlight copy
- Android internal, closed, and open testing
- Synthetic examples, not product behavior
- Publication and handoff evidence

## Ownership and timing

The agent finalizing a mobile beta or test build immediately prepares practical
instructions from its diff and risks. Include the saved path and ready-to-use
copy in the build handoff so the user or another owner can refine or append it.

Tester instructions explain actions and expected results; production storefront
notes explain released outcomes. Keep these audiences separate. New or edited
notes use no em dashes unless explicitly requested by the user, regardless of
repository house style.

## Persist with the exact build

Inspect repo instructions, release docs, app metadata, CI, and established
TestFlight/Fastlane/Play paths. Reuse their build-bound convention. Retain each
artifact's snapshot even when the active upload-input file changes.
If no convention exists, use this Markdown default in the target repository:
`docs/testing-notes/<app>/<platform>/<public-version>-<build-id>/<locale>.md`.
Resolve components from evidence; `build-id` is Android `versionCode` or iOS
build number. Record app/package or bundle identifier, public version, exact
artifact/build identity and kind (such as ad hoc or simulator), source commit
when known, locale, and group or track. Mark missing evidence explicitly.

Keep full checklist and platform copy in labeled sections. Record prepared or
published status and established remote identity as prose, adding no policy
fields or provider integration. Local edits alone are not publication.

- Same artifact (no recorded identity value differs): refine its note,
  preserve useful additions, and record the edit. Wording changes need no
  rebuild.
- New code/artifact: create a new record carrying relevant unresolved regression
  checks with origin and status, adding the next unused build suffix (such as
  `3.2.0-145-2`) when its path is taken. Never overwrite another artifact's
  record; old results do not establish verification of the new artifact.
- Same artifact changing tracks: reuse relevant checks, reclassify audience,
  platform, track, locale, and access, and keep distinct destination sections.
  Promotion needs its own authority.

## Write a reusable full checklist

Prioritize risky changed workflows and adjacent regressions using the exact
build's changes, bug evidence, and tests. For each check, say where to go, what
to do, and the expected result. Include necessary role, feature access, device,
environment, prerequisites, and safe test data from verified local context.
Name missing access/data as a blocker; never invent credentials.

Select install/upgrade, sign-in/session, navigation, loading/errors, offline/
retry, background/resume, permissions, accessibility, and layout checks by risk.
Scope native back navigation, keyboards, and permission prompts by platform.
Separate observed results from requested testing. Name gaps, unsupported cases,
and unresolved failures. Simulator/static checks do not prove device behavior;
a prepared checklist does not mean the build passed.

Use approved accounts and disposable fixtures. Include no passwords, tokens,
private customer records, or internal-only links. Real payments, messages,
destructive actions, or production data writes require specific authorization
and safe data.

Request build/version, device/OS, role/environment, steps, expected versus actual
behavior, occurrence time, and useful redacted screenshots/logs in the full
checklist. Name an established feedback channel; note preparation does not
permit sending email or messages.

## iOS TestFlight copy

Prepare localized **What to Test** for the exact app, platform, public version,
build, and locale, focusing on changes and risks. Apple's
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
describes test information; its
[internal tester guidance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
binds localized What to Test to a selected build, available to every group with
access. Keep copy safe for that entire audience. App-level beta descriptions
are a separate field. Use existing upload/locale conventions.

[External testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)
requires What to Test for the selected build; never hand off an external build
without it. Apple documents no numeric limit; check each locale against its
destination's enforced limit: repository or upload-tool rules, App Store
Connect validation, or an authorized write's result. Over-limit copy is not
ready: trim it, keeping the full checklist. Without a confirmed limit, report
the copy as prepared, limit unverified.

## Android internal, closed, and open testing

Prepare a full checklist and compact testing-track copy. Play `releaseNotes`
describes changes, not a separate TestFlight-style What to Test field. Describe
changed flows and test focus without promotion or requests for user actions.
[Play release guidance](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en)
allows **500 Unicode characters per language**. Check each locale with
Unicode-aware counting and destination validation.

Resolve package, `versionName`, `versionCode` or complete `versionCodes` set,
track identifier, and language tag. The
[Tracks API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks)
binds releases and localized notes to tracks/version codes; release names or
public versions alone do not identify the destination.

Scope internal copy to authorized internal testers, closed copy to its
restricted group/track, and open copy to the broader opt-in audience.
[Play testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
explains track access and feedback. Full steps stay in the repo and an existing
authorized, tester-accessible instruction destination when available. Otherwise
report the access gap; invent no public link or new surface and send no message.
For an authorized production promotion, reselect storefront outcomes; never
promote tester instructions verbatim.

## Synthetic examples, not product behavior

- Changed feature: “Draft saving improved” becomes “With the approved test
  account, edit a disposable draft's title, save, and reopen it. Expect the new
  title once and the original contents preserved.”
- Safe data: “Test checkout” becomes “With the documented sandbox account and
  payment fixture, buy one test item. Expect one sandbox order and no real
  charge. Stop if sandbox access is absent.”
- Vague anti-pattern: “Test everything; improvements and fixes” becomes “Open
  Settings, change text size, then return to the list. Expect readable labels
  and reachable controls. Physical-device large text remains untested.”
- Compact Play: “Draft editing preserves titles and contents when reopening.
  This testing release also updates large-text list layouts.” Detailed actions
  and feedback requests stay in the checklist.
- Production: “Draft titles and contents stay intact after saving and reopening.
  Large-text list layouts keep labels readable.”

## Publication and handoff evidence

When current-task or saved upload/distribution or release-metadata authorization
covers note updates, the finalizer publishes through that existing workflow and
reads them back in the same task with available credentials. Do not ask again.
Verify exact app/build/locale or package/versionCodes/track/language text and
status. Report failures/readback limits; acceptance does not prove tester access
or approval. Local-only preparation hands off saved paths, copy, and the pending
publish step. Name missing authority/credentials. Infer no build, submission,
invitation, messaging, rollout, production promotion, provider setup, or
product-data-write authority.
