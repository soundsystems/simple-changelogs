# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain what changed before asking about a historical
audit. These entries do not themselves authorize released-history edits.
Guidance prompts stop repeating for a version once a disposition is recorded;
an unanswered prompt records nothing and may be asked again later.

## Contents

- Guidance 1 to 24
- Guidance 25
- Guidance 26

## Guidance 1 to 24

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
| 16 | Structured update notices and recorded backfill dispositions |
| 17 | Product surfaces verified before destinations are saved; `store-only` mobile placement |
| 18 | One plain-language setup receipt and per-surface applicability |
| 19 | Product-area grouping, named stable majors, and flat patch notes |
| 20 | The read-only `scripts/query.ts` and optional curated `RELEASE_NOTES.md` |
| 21 | One empty `## Unreleased` heading after reconciliation |
| 22 | `sharedVersionLines` for apps that share a version number |
| 23 | No em dashes in new release copy; choices read as `**Choice (Recommended)**: consequence` |
| 24 | Tester instructions saved with each mobile test build |

<!-- simple-changelogs-guidance-update version="16" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
<!-- simple-changelogs-guidance-update version="17" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Setup now inventories and verifies real product surfaces before saving destination choices, and full repositories can keep mobile history in app stores only." -->
<!-- simple-changelogs-guidance-update version="18" kinds="behavior,onboarding" backfill="not-needed" summary="Recommended setup now uses progressive confirmation receipts, evidence-relevant questions, and separate source-revision and distribution-guidance identity." -->
<!-- simple-changelogs-guidance-update version="19" kinds="behavior,onboarding" backfill="not-needed" summary="Release notes now group related bullets by product area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
<!-- simple-changelogs-guidance-update version="20" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now lists releases, shows one release, filters entries, and lint-checks changelog structure. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
<!-- simple-changelogs-guidance-update version="21" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
<!-- simple-changelogs-guidance-update version="22" kinds="capability,onboarding" backfill="not-needed" summary="Apps that release separately can now share one version number, so an app that is behind catches up to the latest release number." -->
<!-- simple-changelogs-guidance-update version="23" kinds="behavior" backfill="not-needed" summary="New changelog entries and release-note lines now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
<!-- simple-changelogs-guidance-update version="24" kinds="behavior" backfill="not-needed" summary="Mobile test builds now include saved reusable tester instructions, and production App Store and Google Play notes have explicit field, locale, length, and publication rules; new or edited notes use no em dashes unless explicitly requested." -->

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

<!-- simple-changelogs-guidance-update version="26" kinds="capability,behavior,onboarding" backfill="not-needed" summary="You can now choose which model writes release notes in each coding agent you use; the preference guides delegation, entries are still signed by the model that wrote them, and this update asks once. Agents also read changelogs through query.ts instead of whole files, query.ts gaps lists merges since the last release tag without an entry, query.ts check enforces App Store and Google Play note limits, and scripts/handoff.ts computes release receipts." -->
## Guidance 26

An optional authoring sidecar, `.simple-changelogs-authoring.json` or a
personal `authoring.json`, records which model and effort should write release
notes in each coding agent the owner uses, defaulting to the most capable model
at `xhigh`. Agents match, delegate, or write with the running model and say
why; signatures always name the actual writer, and the preference grants no
authority. Until a valid sidecar exists, inspection asks **Which coding agents
do you use?** and then which model should write in each.

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

Policy files are unchanged and no backfill is needed.
