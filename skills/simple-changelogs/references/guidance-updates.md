# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain what changed before asking about a historical
audit. These entries do not themselves authorize released-history edits.
Guidance prompts stop repeating for a version once a disposition is recorded;
an unanswered prompt records nothing and may be asked again later.

## Contents

- Guidance 1 to 15
- Guidance 16
- Guidance 17
- Guidance 18
- Guidance 19
- Guidance 20
- Guidance 21
- Guidance 22
- Guidance 23
- Guidance 24
- Guidance 25
- Guidance 26

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

Setup inspection gained structured update notices: when installed guidance is
newer than the repository's, it reports each material change, its kind, whether
released history could benefit from a backfill, and where the detailed notes
live. Agents show the notice before write-capable work, ask about a backfill
only when the metadata says history may benefit, never run one automatically,
and record the disposition with `apply --guidance-backfill <status> --confirm`,
adding `--audit-verified` for a completed audit.

<!-- simple-changelogs-guidance-update version="17" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Setup now inventories and verifies real product surfaces before saving destination choices, and full repositories can keep mobile history in app stores only." -->
## Guidance 17

Setup now reports the Web, Mobile, app-store, CMS, workspace, and release-note
evidence it found before asking, reuses established destinations, asks before
recommending a new one, and rescans to confirm each existing, absent, or
planned surface. Mobile placement gained `store-only` (**App stores only**)
beside `mobile-only`, `web-tabs`, and `web-page`. No choice proves a product
exists or authorizes product UI.

<!-- simple-changelogs-guidance-update version="18" kinds="behavior,onboarding" backfill="not-needed" summary="Recommended setup now uses progressive confirmation receipts, evidence-relevant questions, and separate source-revision and distribution-guidance identity." -->
## Guidance 18

Recommended setup turns repository evidence into one plain-language receipt
with **Confirm**, **Show details**, and **Change something**, and guided setup
asks in dependency order, defining terms when they matter. Inspection reports
scan completeness and marks each surface `detected`, `not-detected`, or
`uncertain`, and reports separate the Git source revision from the guidance
checkpoint. Web archive setup asks whether to build a Release Notes page and
who should see it, version setup can automate patches, and new setups record
`ask` for future release-note surfaces.

<!-- simple-changelogs-guidance-update version="19" kinds="behavior,onboarding" backfill="not-needed" summary="Release notes now group related bullets by product area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
## Guidance 19

Release notes group related bullets under user-recognizable product areas by
default and keep sparse releases flat. Onboarding confirms whether stable major
releases get a concise name beside the version; minor releases need no name,
and patches use one flat **Bug Fixes & Improvements** section. Released history
is unchanged.

<!-- simple-changelogs-guidance-update version="20" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now lists releases, shows one release, filters entries, and lint-checks changelog structure. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
## Guidance 20

The bundled read-only `scripts/query.ts` lists releases, shows one release,
filters entries, and lint-checks the Markdown histories, including legacy `<!--
Agent: ... -->` signatures (`references/querying.md`). Setup writes after
onboarding use the same atomic transaction as onboarding. Optional
`publicReleaseNotes: "curated"` derives `RELEASE_NOTES.md` from the changelog
at each release, accounting every entry as highlighted, rolled up, or omitted
and never dropping breaking or security notes; a curated backfill is optional.

<!-- simple-changelogs-guidance-update version="21" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
## Guidance 21

A reconciled release keeps an empty `## Unreleased` heading in both changelogs
so the next merge cannot land in the newest release, and `query.ts check` flags
a duplicate or non-leading one. An optional audit restores a missing heading
and reports entries the newest release absorbed; moving them needs separate
authority.

<!-- simple-changelogs-guidance-update version="22" kinds="capability,onboarding" backfill="not-needed" summary="Apps that release separately can now share one version number, so an app that is behind catches up to the latest release number." -->
## Guidance 22

Separately versioned apps can share one number through `sharedVersionLines`:
under `catch-up` an app that is behind ships the line's highest number, and
under `bump-shared` every release takes the next one. Notes still follow each
app's own impact. Where two or more apps have no recorded answer, the update
asks **Should your apps share version numbers?** once; nothing is renumbered.

<!-- simple-changelogs-guidance-update version="23" kinds="behavior" backfill="not-needed" summary="New changelog entries and release-note lines now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
## Guidance 23

New changelog entries and release-note lines use commas, colons, periods, or
parentheses instead of em dashes, rewriting the sentence rather than swapping
the character, and setup and update choices read as `**Choice (Recommended)**:
consequence`. Released entries keep their wording.

<!-- simple-changelogs-guidance-update version="24" kinds="behavior" backfill="not-needed" summary="Mobile test builds now include saved reusable tester instructions, and production App Store and Google Play notes have explicit field, locale, length, and publication rules; new or edited notes use no em dashes unless explicitly requested." -->
## Guidance 24

Finalizing a mobile beta or test build now prepares practical tester
instructions and saves them with the exact build; later owners refine them, and
a new build gets its own record that carries forward unresolved regression
checks. TestFlight and Play testing copy bind to their exact app, build, track,
and locale, and production App Store and Play notes follow their field, locale,
and length limits. New or edited release copy uses no em dashes unless the user
asks, whatever the house style, and publication still needs separate authority
and readback.

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

<!-- simple-changelogs-guidance-update version="26" kinds="behavior,capability" backfill="not-needed" summary="Agents read changelogs through query.ts instead of whole files, query.ts gaps lists merges since the last release tag without an entry, query.ts check enforces App Store and Google Play note limits, and scripts/handoff.ts computes release receipts." -->
## Guidance 26

Agents now read changelogs through `scripts/query.ts` instead of opening
whole files: `releases` for the outline and `show unreleased` for pending
work. A whole-file read is kept for a backfill or an approved audit. The new
`query.ts gaps` lists the merges since the last release tag, the newest one
your `releaseTags` style names, that added no changelog entry.

`query.ts check` now holds App Store notes to 4,000 and Google Play notes to
500 characters per locale, counted in Unicode code points, for Fastlane and
Gradle Play Publisher note files.

Delegated release receipts are no longer built by hand: the bundled
`scripts/handoff.ts` computes the policy, decision, changed-path, and
prior-receipt digests and assembles the receipt at the negotiated version.
Simple Changes still validates it.

No question is asked, no setting changes, and no backfill is needed.
