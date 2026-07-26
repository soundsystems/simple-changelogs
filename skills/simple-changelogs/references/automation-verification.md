# Automation and Verification

Use this reference for final review and repository-native checks. Verification
must examine actual state; a response or evaluation report cannot prove its own
filesystem claims.

## Choose Proportionate Evidence

For Markdown-only changes, inspect the diff and render-sensitive structure. If
the task also changes parsers, generated data, product code, packages, store
metadata, or version fields, run the relevant repository tests and consistency
commands.

Prefer existing checks. Search project scripts, tests, CI, release automation,
and instructions before introducing a new command. A small permanent check is
useful when it protects a stable relationship that repeatedly drifts; do not
encode an uncertain or independently versioned relationship.

## Policy and Setup

- `.simple-changelogs.json` validates against the bundled schema.
- Its recorded values match an actual user disposition or documented policy.
- Full or combined web/mobile setup records the user's
  `mobileReleaseNotePlacement`; a missing backward-compatible value is treated
  as unresolved rather than assigned a default.
- The repository maintains both customer and developer histories after
  adoption, unless policy records `developerChangelog: "optional"`.
- Guidance state lives in the repository and no packaged skill files were used
  as per-repository storage.
- Unanswered prompts did not produce an invented status.

## Customer History

- Each customer item describes a durable visible outcome for its real audience.
- Copy excludes implementation recipes, hidden criteria, private incident
  details, and clone-enabling mechanics.
- Legal, privacy, trust, payment, access, and safety wording is accurate and no
  more detailed than users need.
- Public technical identifiers, compatibility detail, and narrow fixes appear
  only when an established expert audience needs them; a comprehensive ledger
  preserves its full verified audience-relevant set without importing internal
  history.
- Feature groups and bullets follow product importance rather than commit order.
- Routine initial-development repairs remain quiet unless they meet the material
  disclosure threshold.
- Links are useful to readers rather than raw commit evidence.

## Developer History

- Technical notes explain why future maintainers will care.
- Migrations, contracts, pipelines, operational changes, architecture, release
  plumbing, and important tests are captured when relevant.
- Current truth stays in the main flow; preserved obsolete context is clearly
  marked as superseded.
- Raw hashes, diff narration, and trivia are absent.

## Release Lifecycle

- Release intent came from repository evidence before pending entries moved.
- `Unreleased` contains only genuine pending work and no empty placeholder.
- Merge reconciliation accounted for all release-bearing inputs.
- Released headings, dates, and established mirrors agree.
- A deploy was not mistaken for a release without evidence connecting them.

## Version Alignment

- The selected bump follows local convention and the shipped contract.
- Initial-development versions and SemVer suffix pre-releases use accurate
  terminology.
- Stable major finalization came from the canonical version and documented
  release boundary, not a branch name or prerelease merge alone.
- A `1.0.0` summary curates the current durable product, while a later major
  summarizes the transition from the prior stable line.
- Published prerelease history remains intact and stabilization churn is not
  repeated in the stable major summary.
- Only app, package, store, and feed fields proven to share the release changed.
- Independently versioned packages, build identifiers, and remote-only values
  were not guessed.
- The handoff gives a concrete source-by-source version map.

## Release-Note Destinations

- Existing public, mobile, documentation, and internal destinations use copy
  appropriate to their audience and platform.
- Every affected destination has an evidence-backed scope map naming its
  audience, product or app, platform, release train, canonical source, positive
  inclusion rules, and explicit exclusions.
- A shared version or release date did not cause identical content to be copied
  across unrelated web, mobile, store, CMS, package, or internal surfaces.
- Representative eligible entries render and representative wrong-platform or
  wrong-role entries remain absent; selectors do not rely on headings or
  keywords alone.
- Web and Mobile histories derive from one canonical item set when local
  architecture supports it; explicit item selectors, nested overrides, empty
  group removal, independent latest-rendered versions, and product-scoped seen
  state are verified.
- Web exposure of the Mobile feed matches `mobileReleaseNotePlacement`:
  labeled tabs, a separate linked page, or mobile-only destinations.
- Renderers ignore raw HTML attribution comments.
- Missing product UI was not created or wired without explicit current-request
  authorization, documented repository policy, or stored permission.
- Internal technical notes appear only where access policy authorizes the
  intended roles.
- Store copy respects local submission and localization workflows.
- Remote metadata is reported honestly when credentials or release authority
  were unavailable.
- Auto-shown summaries wait for higher-priority gates and retain suitable manual
  access.
- Long-form expert archives keep feature narratives, product-area improvements,
  and comprehensive public fixes proportional to the release; referenced media
  exists, has useful alt text, and was not invented or generated without
  authority; anchor indexes resolve to unique nonempty sections.

## Backfills

- The inspected ranges and release boundaries are named.
- Automatic repairs were deterministic and preserved meaning, visibility, and
  release boundaries.
- Semantic candidates had the required authority or remained unchanged.
- Public-to-internal movement was treated as a visibility change.
- Interrupted, failed, and complete audits recorded honest resumable state.

## Signatures

- Each contiguous raw changelog edit has the canonical nearby HTML comment when
  policy enables signatures.
- Runtime identity and timestamp were copied exactly or recorded as
  `unreported`.
- No comment was written when both values would be `unreported` or when policy
  records `signatures: "none"`.
- HTML attribute characters are escaped.
- Existing signatures remain intact and generated customer copy does not render
  them.

## Useful Automated Checks

When local architecture supports them, tests may enforce:

- no empty pending headings;
- signature comments are ignored by parsers;
- latest released heading matches canonical release-note data;
- product metadata known to share one version remains aligned;
- customer-visible code paths trigger the repository's established changelog
  coverage rule;
- authorized surfaces render only the intended audience's entries;
- surface selectors have positive and negative fixtures for shared, web-only,
  mobile-only, store-only, CMS-only, package-only, and internal-only outcomes
  that exist in the repository; and
- web/mobile feed tests cover nested selectors, empty filtered sections,
  independent seen versions, and all recorded mobile placement modes; and
- long-form release media references resolve without placeholders.

Run final commands after the last edit. Record command, outcome, and any skipped
check with its reason; do not summarize stale evidence as current verification.
