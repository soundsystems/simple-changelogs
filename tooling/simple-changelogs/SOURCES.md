# Testing-Note Guidance Sources

## Decisions

The October 6, 2026 owner request assigns the first draft to the agent finalizing
the build and allows a later distributor to refine or extend it. Apply this as
portable behavior for mobile testing workflows, independent of agent provider.
The reference-backed layout keeps platform detail out of ordinary changelog
runs. No provider hooks, policy fields, or publication integrations are added.

The owner also explicitly prohibited em dashes in release notes across all
distributions unless requested. This removes the former house-style exception.

## Evidence

- Positive, owner-verified mobile examples: instructions identify exact screens,
  actions, expected outcomes, accessibility variants, and useful feedback.
  Product names and private build identities are generalized in bundled examples.
- Negative, observed guidance gap: testing-track copy previously inherited
  storefront highlight rules without first-draft ownership or practical steps.
  No private agent's live output is attributed as evidence.
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/): test information and tester feedback.
- [Apple external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/): What to Test is entered when a build is added to an external group.
- [App Store Connect API BetaBuildLocalization](https://developer.apple.com/documentation/appstoreconnectapi/betabuildlocalization): per-build, per-locale `whatsNew`. As of October 6, 2026, neither it nor the TestFlight help pages state a numeric What to Test limit, so guidance defers to the limit the destination enforces.
- [Play release preparation](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en): track-specific notes, content policy, and 500 Unicode characters per language.
- [Play testing setup](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en): internal, closed, and open tracks plus established feedback channels.
- [Play track API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks): releaseNotes, versionCodes, track identity, and localization.

## Boundaries

Examples and behavior fixtures are synthetic. Store limits are current provider
constraints and should be rechecked during publication. Local instruction files
are a handoff source, not proof that testers received them or an artifact shipped.
