# Developer Changelog

## Unreleased

- Added `json.path` assertions on `apps/mobile/app.json#/expo/version`
  ("3.3.0") and `#/expo/android/versionCode` (1842) to the
  `behavior-independent-mobile-release` eval. The case only checked the
  reported version map, so a run that left the public version unbumped or
  overwrote the Android submission counter could still pass; the new checks
  mirror the existing iOS `buildNumber` guard. Also acknowledged
  skill-maintainer guidance 13 with `backfillStatus` `completed` after a
  read-only `query.ts check` audit found both changelogs already lead with
  one `## Unreleased` heading and each 2026-07-30 section holds only its own
  entry, so nothing was absorbed or needed repair.
<!-- simple-changelogs-signature agent="Claude Fable 5.1" at="2026-10-01T17:00:51-05:00" -->
- Corrected the `behavior-independent-mobile-release` eval's `json.path`
  assertion on `apps/mobile/app.json#/expo/ios/buildNumber` from "3.2.0" to
  "1842" to match the fixture and sibling `behavior-shared-train-release`
  case. "3.2.0" was the fixture's prior public version, so a correct run
  (bump `expo.version` to 3.3.0, leave the build number alone) failed and
  only a run that overwrote the build number with a public version could
  pass, violating `version-decisions.md` and release-identifier invariant 3.
<!-- simple-changelogs-signature agent="Claude Fable 5.1" at="2026-10-01T16:29:58-05:00" -->
- Reversed the release-lifecycle rule that removed an empty `Unreleased`
  heading after reconciliation. A downstream reconcile left no heading, so the
  next merge prepended its entries into the newest released section with the
  changelog gate still green. The full, Web, Web+CMS, Mobile, and
  skill-maintainer lifecycle, verification, backfill, and querying references
  and the `SKILL.md` edit steps now keep one empty `## Unreleased` heading in
  both changelogs as the prepend anchor. `query.ts check` (canonical copy and
  all five vendored copies) accepts a lone empty heading, reports every
  `Unreleased` heading after the first as a diagnostic, and adds a
  non-failing `unanchored` note when the first release heading is not
  `Unreleased`.
- Advanced guidance to full 21, Web 20, Web+CMS 20, Mobile 19, and
  skill-maintainer 13 (`SKILL.md`, provider markers, distribution manifest,
  and `GUIDANCE_VERSIONS` in every `setup.ts` copy) with a `behavior`
  update notice marked `backfill="optional"`. Repositories that reconciled
  under the old rule have no `Unreleased` heading, and their next prepend can
  land inside a released section, so the old rule can already have affected
  released history. The optional audit restores the missing empty heading and
  reports any entries the newest release absorbed; moving them stays a
  meaning-changing edit that needs separate authority.
- The four release-reconciliation behavior evals now require `Unreleased` to
  be the first depth-2 heading, empty, and directly followed by a versioned
  heading, plus a case-insensitive no-duplicate assertion (via `(?i:...)`,
  since the harness compiles with only the `u` flag).
  `manifest-coverage.check.ts` pins both patterns and exercises them against a
  misplaced next-major layout; `query.check.ts` covers the empty, duplicate,
  and unanchored cases.
<!-- simple-changelogs-signature agent="Claude Opus 5.5" at="2026-09-30T16:54:26-05:00" -->
- Added distribution-topology reconciliation to consumer discovery and broad
  publication runs. When `.simple-changelogs.json` selects `web-cms` and the
  matching combined consumer is present, a standalone `simple-changelogs-cms`
  consumer is now reported as `superseded-install` with
  `supersededBy: "simple-changelogs-web-cms"`; publication removes its package
  and lock instead of reinstalling it, unless repository instructions require
  both independently. `.simple-changelogs-cms.json` remains the combined
  package's protected-CMS policy. Updated release-map, production-loop, and
  merge-verification guidance and added discovery coverage for the retained
  sidecar and both-package topology.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-09-02T17:54:18-05:00" -->
- Aligned handoff negotiation with the consumer-owned compatibility contract:
  schema-digest differences are advisory while missing version overlap remains
  blocking, capability schemas accept positive integer protocol versions, and
  request/receipt payloads continue to validate against the packaged schemas.
  Updated the pinned capabilities digest and advanced this repository's recorded
  skill-maintainer guidance checkpoint from 11 to 12.
- Made request `attempt` and `environment` optional informational fields across
  the runtime types, closed-object validator, consumer-owned request schema, and
  every vendored copy; present values retain shape validation but are never
  stored, echoed, or used as retry identity. Regenerated request digests and
  consolidated all six provider-marker payloads behind `providerMarkerFor`.
- Added the CMS-only entry handoff on `boundary: "none"` and release train
  `cms-operators`: relevant classification returns the new schema-valid
  `classified` receipt, prepare writes only `CMS_CHANGELOG.json` and returns its
  path and digest with `release: null`, and verify proves finalized-target
  containment through revision lineage. CMS advertises receipt v2 only; updated
  every vendored receipt schema and digest, shipped the protocol contracts and
  guidance with the CMS distribution, and added end-to-end
  classify-to-prepare validation plus marker and distribution-boundary coverage.
- Accepted Simple Changes guidance 21 while preserving the existing workflow
  policy and recording balanced proposal scheduling.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-09-02T11:05:06-05:00" -->
- Shipped a machine-readable `changelog-provider.json` marker beside each
  advertised distribution, recording the distribution, guidance checkpoint,
  advertised features, request/receipt versions, and canonical schema digests
  that `setup.ts` computes at use time. `provider-marker.check.ts` keeps every
  marker byte-identical to computed capabilities and aligned with
  `distribution-manifest.json`; regenerated the pinned guidance versions
  (full 20, Web 19, Mobile 18, skill-maintainer 12, Web+CMS 19) after this
  branch's checkpoint bumps.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-26T09:20:17-05:00" -->
- Added the curated release-notes layer (design:
  `docs/plans/2026-08-25-curated-release-notes.md`):
  - Policy: optional `publicReleaseNotes: "full" | "curated"` (default full)
    and `curationBudget {min,max}` (defaults 3/8) with CLI flags, interlocks,
    contextual updates via `atomicReplaceSet`, schema and receipt coverage.
  - Conventions in new `references/curation.md` (five markdown distributions):
    derived-never-authored `RELEASE_NOTES.md`, provenance comments binding
    12-hex entry identities, non-filterable Breaking/Security classes, patch
    min-exemption, release-receipt integration; surface layer mapping
    documented in `release-note-surfaces.md`.
  - Parser: `entryIdentity()` and `parseReleaseNotes()` in
    `changelog-parse.ts`; `query.ts` gains `entries --ids`,
    `show <release> --omitted` (omitted + rolled-up lists), and curation
    coverage in `check` (exact-once multiset accounting, budget enforcement,
    diagnostics for malformed provenance).
  - CMS first cut: optional `highlights` and `curation` accounting on release
    objects with `cmsChangeId()` (sha-256 derived ids), enforced by both
    shipped validators and JSON schemas. CMS-only guidance advanced 4 to 5;
    the Web+CMS CMS track advanced 1 to 2 via the new dual-track notice
    machinery; curated-notes guidance folded into this branch's unreleased
    markdown-distribution checkpoints.
  - 27 new tests across `curated-release-notes.check.ts`,
    `curation.check.ts`, and `curation-query.check.ts`; distribution size cap
    raised to 370 KiB.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-25T17:13:45-05:00" -->
- Made the Web+CMS CMS guidance track functional: `guidanceUpdateNoticeFor`
  now also compares the CMS policy's `guidance.version` against
  `WEB_CMS_CMS_GUIDANCE_VERSION` (merging both tracks into one notice, with a
  synthesized fallback change entry until CMS-track markers exist), and
  `updateGuidanceDisposition` advances both policy files atomically for
  web-cms. `validateCmsPolicy` accepts `guidance.version >= 0` so a
  behind-track policy is inspectable rather than malformed; onboarding still
  never writes 0.
- Routed `completePartialAudit`, `updateGuidanceDisposition`, and
  `updateContextualPreferences` through a new `atomicReplaceSet` helper
  (shared transaction marker, staged writes, rollback on failure), covering
  the previously unprotected web-cms two-file audit completion. No-op
  detection in `updateContextualPreferences` uses canonical-JSON structural
  equality, so identical re-runs report `already-configured` without
  `--confirm` or a rewrite. Five regression tests added in `setup.check.ts`.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T15:21:17-05:00" -->
- Added read-only history querying across the five markdown distributions:
  - Promoted the deterministic parser core of `curation-source.ts` into a
    shipped `scripts/lib/changelog-parse.ts` (fence/comment awareness,
    optional version/date headings, occurrence disambiguation, never-guess
    diagnostics) with support for the legacy
    `<!-- Agent: NAME | MM/DD/YYYY ... -->` signature dialect.
  - Added `scripts/query.ts` (`releases`, `show`, `entries`, `check`;
    `--json`, `--log`, `--repo`) with JSON fields aligned to the CMS entry
    vocabulary, byte-parity enforced by `tooling/distributions.check.ts`, a
    340 KiB distribution size cap, `references/querying.md`, and 11 tests in
    `query.check.ts`. Guidance advanced to full 20, Web 19, Mobile 18,
    skill-maintainer 12, and Web+CMS 19; CMS-only remains at 4.
- Fixed `--task-mode read` durable writes: `applySetup` now returns the
  read-only block before `completePartialAudit`, `updateGuidanceDisposition`,
  and `updateContextualPreferences`; regression tests cover all three paths.
- Fixed the shipped CMS policy validator rejecting
  `newReleaseNoteSurfaceComponents` (written by `cmsPolicyFor` and allowed by
  `repo-policy.schema.json`), and aligned the divergent `changelogPath` rules
  (lib validator and JSON schemas now enforce setup's repository-root JSON
  filename rule).
- Hardened the Simple Changes handshake: vendored the consumer-owned
  `changelog-capabilities.schema.json` beside the request/receipt schemas,
  pinned its digest in `protocol-digest.check.ts`, validated `capabilitiesFor`
  output against it, and added `references/release-handoff.md` to the
  byte-parity set. `protocol-provenance.json` now names the owner repository.
- Documentation and onboarding cleanup: removed eleven stray `+##` diff
  artifacts breaking guidance-19 headings; onboarding examples now invoke each
  distribution's own `setup.ts` (including global installs) instead of the web
  variant's path; removed the mobile-variant web-archive walkthrough that
  contradicted its boundaries; reconciled the full distribution's
  mobile-placement question with the guidance-18 evidence rule; replaced
  workspace-specific "Biome/Ultracite" wording with repository-native checks;
  added `references/onboarding.md` router rows and dropped the stale
  "older than version 6" sentence.
- Open-source readiness: added Apache-2.0 `LICENSE`, `CONTRIBUTING.md`,
  `SECURITY.md`, `CODE_OF_CONDUCT.md`, a `license` field in `package.json`, a
  distribution-value-to-skill-directory table and version-agnostic install
  example in the README, and removed a stale `.gitignore` entry.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T12:30:43-05:00" -->
- Resynced the vendored Simple Changes protocol schemas
  (`changelog-request.schema.json` / `changelog-receipt.schema.json` in
  `tooling/simple-changelogs/evals/schemas` and every `skills/*/schemas` copy)
  to byte-exact copies of the consumer-owned canonical schemas, fixing
  `schema-digest-mismatch` failures during capability negotiation:
  - Updated schema-parity checks for the versioned receipt shape (`anyOf` of
    `$defs.v1`/`$defs.v2`) and skipped conditional refinement branches in the
    closed-object walk.
  - Added `protocol-digest.check.ts`, a drift guard that pins each vendored
    schema's canonical-JSON SHA-256 digest and directs maintainers to resync
    from the simple-changes repository when it fails.
  - Raised the distribution size cap to 310 KiB for the dual-shape receipt
    schema.
- Accepted the Simple Changes guidance update in `.simple-changes.json`
  (guidance version 12 to 18); workflow policy choices are unchanged.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T11:54:37-05:00" -->
- Added portable release-organization preferences across the five
  public-history distributions while keeping CMS-only excluded:
  - `releaseNoteGrouping` accepts `product-areas` (default) or `flat`;
    user-recognizable areas are merged across a release, ordered by importance,
    and omitted when they would create a one-item category. Patch releases
    always use one flat **Bug Fixes & Improvements** section.
  - `majorReleaseNaming` accepts `named` (default) or `version-only`.
    Onboarding explicitly confirms the choice, descriptive names remain
    presentation beside canonical stable-major versions, and minor releases
    require no name.
  - Added repository-policy and global-preference persistence, setup CLI flags,
    runtime types, schemas, validation, and regression coverage. Guidance
    advanced to full 19, Mobile 17, skill-maintainer 11, Web 18, and Web+CMS 18;
    CMS-only remains at 4.
  - Removed duplicated final verification checklist items from the canonical
    full, Mobile, Web, and Web+CMS surface guidance.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-22T14:10:32-05:00" -->
- Added `distribution-manifest.json` as the machine-readable map of all six
  distributions and their current, independent guidance checkpoints. The README
  now documents source identity separately from the selected distribution and
  guidance, while `tooling/distributions.check.ts` enforces manifest parity and
  the required identity wording across every packaged distribution.
- Consumer discovery now returns `physicalInstallPaths`, `symlinkPaths`, and
  deduplicated `resolvedInstallPaths`; the publish loop updates each resolved
  target once, re-runs discovery, rejects dangling or out-of-scope targets, and
  verifies the original link topology and `installationCount` before merge.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-20T16:27:21-05:00" -->
- Reduced first-use onboarding decision load while tightening evidence gates
  across all six distributions:
  - Added a one-answer recommended flow that turns inspection evidence into one
    plain-language receipt and one confirm-or-revise response. Customized setup
    now defines technical terms at first use and orders questions by dependency:
    topology, audiences, destinations, destination details, version behavior,
    audit comments, storage, instruction pointer, then history handling.
  - Added progressive-disclosure confirmation receipts across every
    distribution: a compact consequential summary appears first with
    **Confirm**, **Show details**, and **Change something** actions. The complete
    receipt remains available, and undisplayed details cannot broaden authority.
  - Setup inventory now returns scan completeness and per-surface
    `detected`, `not-detected`, or `uncertain` applicability. Mobile placement is
    suppressed only after a complete scan finds recognizable non-Mobile product
    structure; incomplete or low-evidence scans emit one
    `product-topology-confirmation` question instead.
  - Replaced Web archive placement and discovery with a two-step flow. **Should
    I build a Release Notes page?** defines the complete shipped-update history,
    offers a dedicated page, an existing page, or none, and states that building
    it does not expose it live. **Who should see Release Notes?** then maps
    developer, preview-reviewer, and live-visitor labels to
    `releaseNoteEnvironmentScope`.
  - Expanded public-version onboarding with explicit automatic-patch/ask-minor-
    and-major and automatic-patch-and-minor/ask-major choices, plus concrete
    `1.5.0` to `1.5.1`, `1.6.0`, and `2.0.0` SemVer examples.
  - Removed the hypothetical `newReleaseNoteSurfaces` authority question from
    ordinary first-time setup. New policies default to `ask` and defer the
    decision until an exact missing surface is needed; explicit advanced
    `allow` and `existing-only` values remain valid with their existing authority
    limits.
  - Advanced guidance to full 18, Web and Web+CMS 17, Mobile 16,
    skill-maintainer 10, and CMS-only 4. These changes are prospective and do
    not require rewriting released history.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-20T14:41:13-05:00" -->
- Made product onboarding evidence-led across full, Web, Mobile, Web+CMS, and
  CMS-only distributions:
  - Setup inspection now inventories and reports Web, Mobile, store, CMS,
    workspace, and established release-note candidates before asking destination
    questions. Existing destinations are reused; absent destinations are
    recommended only as proposals requiring authorization for the exact current
    surface.
  - Added a post-selection rescan and confirmation step that classifies every
    selected surface as existing, absent, or planned and lets the owner confirm
    the plan or choose again. Selected types are never treated as repository
    evidence, and setup cannot invent products, routes, authentication,
    credentials, workspace topology, or monorepo membership.
  - Extended full-distribution `mobileReleaseNotePlacement` with `store-only`.
    User-facing choices now distinguish **App stores only**, **Mobile app and
    stores — no Web history**, **Web and mobile — one tabbed Release Notes
    page**, and **Web and mobile — separate Release Notes pages**, while
    preserving the existing `mobile-only`, `web-tabs`, and `web-page` values.
  - Retained the first-use workflow primer, one-question-at-a-time walkthrough,
    structured update notices, no-state-change assurance, detailed release-note
    path, and separate conditional backfill disposition.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-14T18:32:57-05:00" -->
- Tightened producer receipt invariants so `releaseImpact: "none"` must return
  `not-applicable`; `decision-required` additionally requires a proven public
  boundary and non-`none` bump. Regression coverage rejects internal-only work
  that incorrectly requests public-version approval.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-12T10:57:32-05:00" -->
- Corrected producer capability negotiation across every packaged distribution
  and the maintainer runtime: request and receipt schema digests now hash parsed,
  RFC 8785-style canonical JSON instead of formatting-sensitive source bytes,
  and feature advertisement no longer includes the non-protocol setup notice
  feature `guidance-update-notices`. Setup notice behavior remains available,
  while coverage now verifies the canonical digests against the shared handoff
  implementation and the exact shared protocol feature set.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-11T16:59:16-05:00" -->
- Added machine-readable guidance-update markers and structured
  `guidanceUpdate` results with material-change categories, aggregated backfill
  recommendations, concise summaries, conditional prompts, and detailed
  release-note paths across all six distributions, including CMS-only.
  Release-protocol capability advertisement remains limited to the three shared
  features, and guidance versions advanced.
- Added confirmed one-time disposition persistence through
  `apply --guidance-backfill <status> --confirm`, requiring
  `--audit-verified` for completed audits, with setup-result types, schemas,
  tests, and distribution byte budgets updated for the new contract.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-14T20:27:00-05:00" -->
- Added explicit public-version authority and a structured release handoff
  protocol:
  - Added optional `publicVersioning` policy for independent patch, minor, and
    major `ask` or `automatic` behavior plus optional exact-version suggestions.
    Repository, global-preference, and run-only resolution preserves the safe
    ask/ask/ask default and prevents global preferences from silently
    authorizing a release.
  - Extended setup with deterministic version flags, closed policy validation,
    effective-policy resolution, capability discovery, coordinated-onboarding
    contributions, and owner-specific write receipts. CMS-only policy remains
    excluded.
  - Added pinned request v1 and receipt v2 schemas, protocol provenance,
    RFC 8785-style canonical JSON and SHA-256 decision binding, phase-specific
    request and receipt validation, closed reason/action codes, revision
    lineage, and per-release-train classify, prepare, and read-only verify
    semantics.
  - Propagated the policy and handoff guidance across full, Web, Mobile,
    Web+CMS, and skill-maintainer distributions, advancing guidance to 15, 14,
    13, 14, and 7 respectively while keeping CMS-only guidance independent.
  - Expanded setup coverage for safe missing-field resolution, custom granular
    storage, global-prefill non-activation, capability digests, and owner
    receipts; added handoff unit coverage for canonical digests, closed
    phase-specific requests, `decision-required` versus `blocked`, and prepared
    and verified invariants; added safe-default, exact-direction, and no-boundary
    behavioral cases; and updated parity and release-boundary tests.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-10T17:41:26-05:00" -->
- Added repository-local contextual release-note link policy:
  - `releaseNoteLinks` accepts `when-useful` (recommended), `ask`, or `disabled`
    across full, Web, Mobile, and Web+CMS distributions. CMS-only and
    skill-repository selections reject it, and portable global preferences never
    store it.
  - Added shared runtime constants and types, repository-policy and setup-result
    schema coverage, validation, setup receipts, confirmed updates for already
    configured repositories, and CLI option `--release-note-links`.
  - Surface guidance treats discovered routes as candidates only. Contextual
    actions require same-release availability plus matching audience,
    authentication, role, tenant, feature-flag, platform, and environment
    eligibility; structural summary-to-archive links remain outside this policy.
  - Propagated the setup helper across all packaged distributions and extended
    setup, validation, schema-parity, production-boundary, and distribution
    contract coverage.
  - Advanced guidance to full 14, Web and Web+CMS 13, and Mobile 12.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-09T02:28:39-05:00" -->
- Standardized progressive setup questions and added public Web Release Notes
  environment scope:
  - Every unresolved preference now uses a plain-language, numbered, choose-one
    list presented one question at a time. Options name their outcome, mark the
    evidence-backed recommendation, explain owner and user impact, state the
    saved change, and give the important tradeoff. Compact text diagrams
    accompany audience, environment, data-flow, and write-scope decisions where
    the paths are easier to compare visually.
  - Added optional repository policy `releaseNoteEnvironmentScope` and CLI
    option `--release-note-environments` for the full, Web, and Web+CMS
    distributions. Runtime types, repository-policy and setup-result schemas,
    validators, setup receipts, confirmed in-place policy updates, and tests
    cover `all-environments`, `non-production`, `production-only`, and
    `disabled`.
  - The field is intentionally excluded from portable global preferences and
    rejected for unsupported Mobile, skill-repository, and CMS-only policy
    selections. Validation also rejects unknown and superseded field forms
    without replacing existing repository state.
  - One environment gate controls the entire approved public Web surface:
    route or page, navigation and manual links, compact summaries, and automatic
    modal. `all-environments` exposes it locally, in previews, and in
    production; `non-production` exposes it only in local development and
    recognized previews; `production-only` exposes it only in production; and
    `disabled` exposes it nowhere. Local and preview only (`non-production`) is
    recommended for marketing and client sites.
  - Enforcement occurs at the route, server, or build boundary and at every
    entry point. Hidden dynamic routes return the framework-standard not-found
    response, while static builds omit the route when supported instead of
    merely unlinking it.
  - Environment classification uses the deployment platform's authoritative
    signal, treats local development as non-production, forbids hostname and
    branch-name guesses, and fails closed when a scoped environment is unknown.
    The preference controls exposure only: it grants no new surface, dependency,
    deployment, or publication authority and does not change changelog
    generation or archive-data synchronization.
  - Advanced guidance moves to full 12, Web and Web+CMS 11, Mobile 10, and
    skill-repository 6. Standalone Mobile and skill-repository setup adopt the
    clearer question presentation without recording the Web-only environment
    preference; standalone CMS retains its independent guidance version.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-09T00:39:40-05:00" -->
- Added release-identifier semantics and cross-surface version policy:
  - `VERSION_IDENTIFIER_ROLES` adds `canonical-release`, `public-version`,
    `build-number`, and `development-version`. `VersionMapRecord` now requires
    `identifierRole` and accepts optional `field` and `releaseTrain`, mirrored in
    the response schema and covered by schema parity.
  - A cross-field validator enforces at most one `canonical-release` per
    `releaseTrain`, an invariant JSON Schema cannot express.
  - `PROTOCOL_VERSION` moves to 2 because existing version-map response objects
    are invalid without `identifierRole`. Updated `lib/model-eval.ts`, both
    runner schemas, and every hard-coded response in the adapter, validator,
    fixture, and CLI tests, flipping their negative cases to version 3. No
    bundled skill file or `agents/openai.yaml` references the protocol, so
    installed packages are unaffected.
  - Extended all three closed version-map expectation definitions in lockstep —
    `lib/validate.ts`, `evals/schemas/eval-manifest.schema.json`, and the
    `isRecordWithOnlyKeys` list plus matcher in `lib/fixtures.ts` — so each new
    property can be asserted independently.
  - Repository policy accepts optional `crossSurfaceVersioning` with `shared`,
    `independent`, and `mixed`, plumbed through both policy validators, the
    setup selection and apply options, `--cross-surface-versioning`, and both
    closed definitions in the setup-result schema. Absence stays valid and the
    field never reaches global preferences or either CMS policy schema.
  - Added a surgical update path: ordinary apply refuses configured
    repositories, so `updateCrossSurfaceVersioning` runs before
    `preSetupResult`, requires `--confirm`, rewrites one field, revalidates, and
    is tested field-by-field against distribution, guidance version, backfill
    status, signatures, developer-history policy, surface policy, component
    policy, and mobile placement.
  - Guidance moves to full 9 and mobile, web, and web+CMS 8, with matching
    `guidance-updates.md` entries. `MOBILE_PLACEMENT_MIN_GUIDANCE` stayed pinned
    at 6 and its regression test still passes after the bump.
  - New contract assertions match against whitespace-collapsed source so
    ordinary prose reflow cannot fail them; verified by wrapping a required
    phrase across three lines and by mutating two rules to confirm both bite.
    They also assert byte parity for `version-decisions.md` across the four
    product distributions and for the two bundled CMS policy schemas.
  - Repaired pre-existing drift: the web+CMS bundled CMS policy schema was
    missing `newReleaseNoteSurfaceComponents` that its CMS twin carried, with
    nothing enforcing parity between them.
  - Added four `version-trains-*` fixtures (independent, ambiguous, shared,
    mixed) and seven behavior cases covering both independent directions, shared
    mirror reconciliation, mixed subgroups, the three-turn ambiguity flow, release
    names, and store-only copy. Each fixture policy was validated through the
    setup helper first; all four needed an explicit `distribution` and
    `mobileReleaseNotePlacement` to avoid being reported malformed at guidance 6
    or newer.
  - Note: `bun run check` runs the suite in parallel and the spawn-heavy
    contract, CLI, and fork-sync tests time out under load on this machine
    regardless of these changes — unmodified `main` failed 11 and 18 tests on
    two consecutive baseline runs. All 288 tests pass when files run serially.
<!-- simple-changelogs-signature agent="Claude Opus 5" at="2026-07-29T17:07:03-05:00" -->
## 2026-07-30

- Added portable release-note keyword-emphasis and detail-budget guidance to
  the full, Web, Web+CMS, and Mobile distributions:
  - Semantic strong emphasis is a sparse scan anchor for the smallest exact
    product term and follows the product's established strong or accent
    treatment without relying on color alone.
  - Product and app surfaces, core components, filters, categories, formats,
    and other public product-contract nouns are explicit candidates.
  - Feature bullets stop at the capability and practical outcome instead of
    inventorying every emoji, gesture, shortcut, role recommendation, or
    transient control state.
  - Advanced guidance from 10 to 11 for full, 9 to 10 for Web and Web+CMS, and
    8 to 9 for Mobile. Synchronized every setup version map across packaged
    and maintainer tooling.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-30T16:05:31-05:00" -->

## 2026-07-27

- Established production Web deployment as an unconditional product-release
  boundary across the full, Web, and Web+CMS distributions:
  - Every target-contained customer or developer `Unreleased` item must enter
    one dated, versioned release, with canonical histories, established Web
    mirrors, and proven product-version metadata merged into the deployment
    target first.
  - Pending items require evidence that they are absent from the target or
    belong to another unshipped train. Version ambiguity, unmerged
    reconciliation, or deploy-contained pending work blocks production.
  - Retries and promotions may reuse a version only for the exact
    already-reconciled target. Already-deployed violations require forward
    reconciliation rather than rewriting deployed history.
  - Advanced guidance from 8 to 9 for full and from 7 to 8 for Web and Web+CMS.
    Synchronized setup version maps and deterministic setup coverage enforce
    the new levels and distribution boundaries.
  - Completed the repository's Guidance 5 historical audit. That guidance
    changed prospective onboarding pointers only, so the released range through
    2026-07-08 required no wording, audience, boundary, or mirror repair.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T22:04:07-05:00" -->

- Scoped the Repository-instruction pointer onboarding step and moved it after
  the preference-scope question in all six distributions.
  - It previously asked only about a repository file, and ran *before* the scope
    question, so it asked for a file target before the flow knew whether the
    user works per-repository at all. Repository scope now targets the
    repository's instruction file, all-projects scope targets the user's global
    one, and run-only writes nothing.
  - A global pointer stays distribution-neutral -- no distribution, path, route,
    or repository named -- matching the constraint already carried by global
    preferences. Naming one would be wrong in any repository using a different
    distribution or a local fork.
  - The global file is called out as the higher-consequence write, since it
    applies to every repository on the machine including ones this skill does
    not serve. Both scopes remain ask-first.
  - Amends the same unreleased guidance entry rather than adding a version:
    the incomplete form shipped earlier the same day and nothing consumes it.
  - Fixed the check that caught this. `manifest-coverage.check.ts` asserted the
    pointer prose against raw file text, so a line break falling between any two
    words failed it even though the wording was unchanged; the `\s+` in the
    in-place-update pattern was a band-aid over the same problem at one known
    wrap point. The assertions now collapse whitespace first and compare
    phrases, so reflowing a paragraph no longer breaks the suite while a real
    wording change still does. Verified by reflowing the sentence to the wrap
    that previously failed and confirming the suite passes.
  - Applied the same hardening to the three other patterns carrying that
    band-aid: `RECORDED_DISPOSITION_PATTERN`, `SHARED_RELEASE_SCOPE_PATTERN`,
    and `WRONG_SURFACE_EXCLUSION_PATTERN` (wrong-platform/wrong-role absence).
    Each now compares whitespace-collapsed text. Mutation-checked: altering the
    role-absence wording in a distribution's `automation-verification.md` fails
    the suite, and restoring it passes.
<!-- simple-changelogs-signature agent="claude-opus-5" at="2026-07-27T03:20:00-05:00" -->
- Corrected `publish-skill` ownership classification:
  - `SKILL.md` and `references/release-map.md` now capture a concrete baseline
    for checkouts, refs, status fingerprints, worktrees, proposals, and live
    exact-target claims. Static dirty state and pre-existing artifacts are
    preserved baseline information; only post-baseline activity or a live
    exact-target claim becomes externally owned active work.
  - `references/production-loop.md` continues canonical, fork, and consumer
    publication from isolated remote-default worktrees unless new external
    activity overlaps the exact target. Active work still requires explicit
    handoff and cannot be delegated into scope.
  - `references/merge-verification.md` keeps preserved artifacts out of cleanup
    and separates published results, informational baseline state,
    externally-owned active work, and other failed or blocked targets in the
    final matrix.
  - Agent metadata and package-design regression coverage now enforce the
    baseline comparison, independent-continuation, pre-mutation recheck, and
    three-part completion-report contract.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T09:13:11-05:00" -->
- Added repository-instruction pointer onboarding across all six packaged
  distributions:
  - Onboarding now asks before adding a changelog pointer to an existing
    repository-instruction file because that file governs agent behavior beyond
    the changelog workflow.
  - The pointer records decision timing, outcome reporting, and distribution
    ownership without copying classification or wording rules, and reruns
    update an existing pointer rather than appending a duplicate.
  - Guidance advances from 7 to 8 for full, from 6 to 7 for web, mobile, and
    web+CMS, and from 4 to 5 for skill-repository. Standalone CMS gains the
    onboarding pointer while its independent schema guidance remains at 1.
  - The shared setup runtime version map and setup tests now enforce the
    propagated guidance levels and pointer behavior.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:42:34-05:00" -->
- Hardened `publish-skill` around externally owned active work:
  - `SKILL.md` now requires exact handoff before mutation, rejects broad
    terminal requests as ownership transfer, repeats ownership checks
    immediately before each mutation, and includes preserved targets in the
    outstanding-work ledger.
  - `references/release-map.md` classifies current-loop, externally owned, and
    proven-stale branches, worktrees, and proposals before release scope is
    chosen.
  - `references/production-loop.md` adds an ownership gate that preserves
    external state, permits independent remote-default worktrees only when
    changes do not overlap, and forbids delegated takeovers.
  - `references/merge-verification.md` now requires no active owner, proposal,
    dirty state, or unmerged or unpushed commits before cleanup can be treated
    as stale, with ownership checked again immediately before removal.
  - Agent metadata advertises the protected scope, and the package-design
    regression test locks the skill, release-map, production-loop,
    merge-verification, and metadata contracts together.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:11:26-05:00" -->
- Added release-note surface design and component-source contracts:
  - `references/surface-design.md` now ships in the full, web, mobile, web+CMS,
    and CMS-only distributions, with Web, native, and authenticated-operator
    guidance routed from each owning skill and surface reference.
  - Setup always emits `release-note-surface-offer` for those five
    distributions when policy is absent, while destination verification remains
    evidence-gated and skill-repository onboarding remains surface-free.
  - Inspection reports `designSystemEvidence` from dependencies, component
    configuration, repository-owned library paths, and native toolkits. It
    distinguishes established systems from unstyled primitives, defaults proven
    systems to `project-components`, and otherwise requests an explicit
    component-source choice.
  - The optional `newReleaseNoteSurfaceComponents` policy field is synchronized
    across repository and CMS schemas, setup-result schemas, TypeScript types,
    runtime validators, helper selection and persistence, and the
    `--surface-components` CLI contract. The previously omitted
    `mobileReleaseNotePlacement` setup-result fields were added at the same
    closed-schema boundary.
  - Surface receipts keep history seeding independently optional: complete
    eligible canonical history, a narrower confirmed scope, or no seed. The
    runner vocabulary now includes `SURFACE_COMPONENTS_SELECTED`,
    `SURFACE_DEPENDENCY_ADDED`, `SURFACE_HISTORY_SEEDED`, and
    `SURFACE_HISTORY_SEED_DECLINED`.
  - Four new fixtures and five behavior evaluations cover the Base UI
    recommendation, minimal markup, retained Radix, an established design
    system, native components, dependency reporting, successful seeding, and a
    declined seed; setup, schema-parity, manifest, and distribution checks
    protect the same contracts, including CMS-only surface offers.
  - Guidance versions advanced to full 7 and web, mobile, and web+CMS 6. The
    full distribution's Guidance 6 mobile-placement invariant is now pinned to
    its introduction version rather than the moving current version, matching
    schema validation and regression coverage.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T01:38:30-05:00" -->
- Added prospective release-note destination verification to app setup:
  - Setup inventory now reports `adjacentDestinations`, synchronized helper
    copies share the same behavior, and the setup-result schema and TypeScript
    contract expose the new inventory field.
  - Static distribution checks protect destination-verification guidance and
    helper parity across packaged variants.
  - A two-turn `editorial-updates-app` fixture and evaluation cover tab versus
    page selection, an independently authorized latest-release modal, protected
    Changelog naming, one-off surface authority, and historical backfill.
  - This changes prospective onboarding and surface selection only; released
    history and recorded guidance versions remain unchanged.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T00:26:33-05:00" -->
- Standardized comprehensive initial backfills as the confirmed onboarding
  default across all six distributions:
  - The final history question is ordered after every other onboarding choice,
    offers only defer or decline opt-outs, and starts the audit as `partial`
    when the user confirms the receipt without separate review approval.
  - Setup and evaluation tests enforce the default and question ordering, while
    the full-history fixture, manifest coverage, and package-distribution checks
    protect complete public and developer reconstruction through setup.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T23:37:21-05:00" -->
- Added conversational onboarding across all six distributions:
  - Bundled inspection and apply helpers classify read-only versus write work,
    recommend evidence-backed defaults, emit confirmation receipts, validate
    repository and optional solo-developer preference state, and continue the
    triggering task after setup.
  - Closed schemas, fixture coverage, package checks, and setup tests preserve
    distribution-specific policy while preventing unanswered audit choices or
    read-only requests from writing state.
- Added Guidance 6 to the full distribution:
  - Repository policy now records `mobileReleaseNotePlacement` as `web-tabs`,
    `web-page`, or `mobile-only`, while older policies remain valid but
    unresolved until the user chooses.
  - Surface guidance derives Web and Mobile feeds from explicit item and nested
    selectors in one canonical history, removes empty filtered groups, and
    keeps rendered-version and seen-state tracking independent by product.
  - Runtime validation, JSON Schemas, fixtures, behavior cases, and package
    checks cover the policy field and each placement mode.
- Changed `publish-skill` consumer discovery to deduplicate installations by
  physical package identity while preserving every logical compatibility alias.
  Contributor-only coverage exercises aliased installs, true duplicate
  packages, package boundaries, and the bundled scanner through the repository
  test command.
- Adopted the `skill-repository` policy at Guidance 4 and completed the
  authorized released-history audit. The dated public and developer sections
  already matched Guidance 4's durable-history and compact-highlight boundary;
  no released wording, audience, boundary, or mirror repair was required.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T16:16:12-05:00" -->
- Hardened the shared setup helper to require and validate
  `mobileReleaseNotePlacement` for full Guidance 6 policies, expose the
  corresponding CLI selection, and persist each distribution's current
  guidance version instead of a shared stale constant. Setup coverage now
  verifies the full-distribution block and the complete version map.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T17:15:35-05:00" -->
- Synchronized the local `publish-skill` distribution with canonical upstream
  `soundsystems/simple-changes` at `3b37e4b`:
  - Added the bundled `scripts/discover-local-consumers.ts` inventory, which
    resolves exact-source lock entries and installed packages under
    `.agents`, `.claude`, and `.cursor` skill roots and classifies each row as
    installed, multiple-installs, lock-only, or unlocked-install.
  - Replaced the single convenience-consumer step with per-consumer retention
    modes (maintained, validation-only, intentional-pin, stale) and concurrent
    bounded-parallelism reinstallation in which one failure cannot cancel or
    hide the remaining consumers.
  - Updated the frontmatter description and `agents/openai.yaml` interface copy
    to describe fork-plus-consumer publication. The fork carried no local
    deltas, so the sync is a straight upstream mirror.
<!-- simple-changelogs-signature agent="Claude Opus 5" at="2026-07-25T11:40:26-05:00" -->
- Added release-note curation contracts and source parsing:
  - A closed JSON Schema and runtime validator model per-surface groups,
    operation history, continuation and revisit overlap, deployed-impact
    acknowledgments, linked corrections, and completed-operation item
    conservation.
  - Markdown extraction assigns stable SHA-256 identities to atomic changelog
    entries, resolves full-history, release-range, release, section, and
    item-set scopes, strips signature comments, and reports ambiguous structure
    instead of guessing.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-24T00:39:25-05:00" -->
- Split the monolithic package into six changelog-owning distributions:
  `simple-changelogs`, `simple-changelogs-cms`,
  `simple-changelogs-web`, `simple-changelogs-mobile`,
  `simple-changelogs-web-cms`, and `simple-changelogs-skill-maintainer`. The
  latter is the lean Simple Changelogs distribution for repositories that
  develop or publish agent skills. Distinct frontmatter descriptions,
  repository policy selection, and shared mutual-exclusion checkpoints prevent
  multiple distributions from claiming the same repository; legacy policies
  without `distribution` remain compatible with the full package.
- Moved model adapters, evaluation protocols, fixtures, and contributor tests
  under `tooling/`. Public distributions remain self-contained with exactly one
  root `SKILL.md`, no symlinks or maintainer-only artifacts, valid local routes,
  and measured package sizes from 24,653 to 86,825 bytes.
- Added distribution-wide package-shape and portable-contract validation plus
  real Skills CLI consumer-install verification for skill-repository release
  workflows.
- Brought the CMS-only distribution from upstream `main` into this branch while
  preserving its installable schema and runtime repository validator. CMS
  fixtures, package checks, and contributor tests remain repository-only.
- Added a Cursor Agent behavior-harness adapter with read-only skill snapshots,
  optional model selection, explicit force opt-in, normalized responses, and
  deterministic command coverage alongside Codex CLI, Claude Code, Hermes
  Agent, and Grok Build.
- Generalized fork synchronization to parse the upstream distribution name and
  revision from provenance, scope comparison to that distribution's
  `skills/<name>` tree, and retain current/behind/invalid/divergent behavior
  across every packaged variant.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T20:53:07-05:00" -->
- Added an optional Grok Build evaluation adapter:
  - Uses Grok's headless JSON output and validates results against the neutral
    `RunnerResponse` contract.
  - Isolates Grok home and configuration, applies the workspace sandbox, and
    disables memory, subagents, web search, and automatic updates.
  - Supports an environment-based model override and adds unit coverage plus
    README and `EVAL.md` setup documentation.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T18:01:31-05:00" -->
- Added Guidance 4 to separate customer-history inclusion from release-summary
  selection:
  - Durable, identifiable UI and interaction polish can remain in
    `CHANGELOG.md`; incidental cosmetic churn and routine copy cleanup remain
    excluded.
  - Compact release-note destinations now explicitly select material
    highlights instead of inheriting every customer changelog entry.
  - Developer history receives polish only when its implementation or tradeoffs
    create maintainable technical context.
  - Added a routed-app behavior case proving that durable catalog interaction
    polish updates `CHANGELOG.md` without changing developer history or compact
    release-note data, and advanced current fixture policies to guidance 4.
<!-- simple-changelogs-signature agent="Codex" at="2026-07-16T12:48:48-05:00" -->
- Added the `publish-skill-forks` skill package:
  - Added release-map discovery and isolated-worktree protections for canonical,
    downstream-fork, and consumer repositories.
  - Codified canonical merge, merged-commit provenance pinning, fork guidance
    backfills, Skills CLI installation, and final remote default-branch checks.
  - Added a package verifier that compares complete file trees and contents,
    rejects symlinks, and requires exactly one discoverable `SKILL.md`.
  - Required MR or PR descriptions to be re-read after creation and distinguished
    passed, blocked, failed, running, and optional pipeline states.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-16T12:52:00-05:00" -->
- Added the `references/major-releases.md` reference and Guidance 3:
  - Routed stable-major and prerelease work to it from the SKILL.md router,
    release lifecycle, version decisions, and release-note surfaces, keeping
    boundary detection and synthesis single-homed.
  - Added the `initial-major`, `next-major`, and `python-prerelease` fixtures
    plus five cases: `1.0.0` synthesis, `2.0.0` transition, an integration-
    branch merge that must change nothing, a PEP 440 alpha tag, and a
    discover-mode major-release trigger.
  - Bumped recorded fixture policies to guidance version 3; the
    `skill-package` fixture intentionally stays at version 1 for the upgrade
    prompt case.
- Documented the canonical report-code vocabulary in the response schema's
  model-visible descriptions and added a coverage test so every decision,
  authorization, and verification code asserted in `evals/cases.json` stays
  documented there.
- Tightened major-release case assertions: `1.0.0` synthesis now requires the
  developer history heading, and the `2.0.0` transition now requires the empty
  `Unreleased` heading to be removed.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T14:12:57-05:00" -->

- Hardened installed-package skill discovery:
  - Renamed evaluation-fixture skill files to `SKILL.fixture.md`; the fixture
    harness restores the canonical `SKILL.md` name inside each temporary
    workspace so case assertions are unchanged.
  - Added the `NESTED_SKILL_FILE` contract check so a nested discoverable
    `SKILL.md` can never ship in the package again.
- Widened the repository-policy schema from const placeholders to real enums:
  - `developerChangelog` accepts `required` or `optional`; `signatures` accepts
    `agent-and-timestamp` or `none`. Existing policy files stay valid because
    the previous const values remain in each enum.
  - Updated the runtime validator, TypeScript types, schema-parity tests, and
    the setup reference, and added the `single-changelog` fixture plus the
    `behavior-single-changelog-policy` case covering both new values.
- Made fully-unreported signatures illegal prospectively: when neither runtime
  identity nor a trustworthy timestamp is available, the signature comment is
  omitted instead of written as placeholders.
- Single-homed SemVer terminology in `references/version-decisions.md`;
  `references/entry-classification.md` now cross-references it instead of
  paraphrasing, removing a reference-to-reference drift risk the SKILL.md-only
  duplication contract cannot see.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T08:59:29-05:00" -->

- Added an optional Hermes Agent evaluation adapter:
  - Uses Hermes' quiet one-shot interface while validating the returned JSON
    through the same provider-neutral response contract as other adapters.
  - Forces the Docker terminal backend, an air-gapped disposable container,
    and a nested read-only mount over the in-workspace skill snapshot instead
    of trusting Hermes' host-accessible local or SSH backends.
  - Added provider and model overrides, exact command and environment tests,
    response validation coverage, and contributor setup and smoke-test docs.
<!-- Agent: GPT-5 Codex | 07/09/2026 11:14 PM CDT -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T23:14:00-05:00" -->

- Reworked policy and instruction ownership:
  - Added the closed `.simple-changelogs.json` schema and first-use workflow for
    repo-local guidance version, backfill disposition, required developer
    history, signature mode, and release-note surface authorization.
  - Replaced installed-skill mutation and sentinel state with simple,
    prospective guidance updates plus one prompt per new guidance version.
  - Kept customer classification, release lifecycle, versioning, backfill,
    surface authorization, fork maintenance, and automation verification in
    focused references behind a concise `SKILL.md` router.
  - Standardized raw Markdown attribution on an escaped, machine-readable
    identity and ISO 8601 timestamp comment while documenting its non-
    cryptographic limits.
- Added a portable evaluation package:
  - Added closed schemas for manifests, repository policy, runner requests, and
    runner responses, plus runtime validators and parity tests.
  - Added a shell-free adapter runner with timeouts, process-tree termination,
    JSON framing, normalized configuration errors, and isolated Git fixtures.
  - Added 51 canonical trigger and behavior cases with multi-turn assertions for
    setup, backfills, classification, authorization, release lifecycle, fork
    precedence, and skill-maintenance boundaries.
  - Added optional sandboxed Codex and Claude Code CLI adapters while keeping
    the core contract free of vendor terms and authentication requirements.
  - Added deterministic text and JSON reports, stable exit codes, failure
    workspace retention, and a contributor-facing `EVAL.md` protocol guide.
- Moved `check-fork-sync.sh` into the distributable skill and hardened default-
  branch resolution, ancestry checks, invalid inputs, and divergent pins.
- Updated public installation guidance to copy the complete skill package,
  document agent-neutral evaluation, and treat Codex, Claude Code, Cursor,
  Hermes, and Eve as optional runtime examples.
- Closed final review gaps around duplicate setup permission, one-off versus
  ongoing surface authorization, deterministic metadata mirrors, fork-checker
  invocation, eval exit statuses, assertion documentation, and unanswered
  guidance prompts.
- Renamed executable checks from auto-discoverable `*.test.ts` filenames to
  explicit `*.check.ts` inputs, retaining the runnable Bun suite without letting
  unrelated JavaScript test runners execute installed skill code implicitly.
- Hardened representative model execution after live smoke tests:
  - Added optional per-adapter model overrides and isolated Codex runs from
    inherited MCP configuration while normalizing stale or unsupported model
    failures as configuration errors.
  - Dereferenced the neutral response schema only for Claude Code's structured-
    output flag, paired an explicit tool inventory with an explicit allowlist,
    and retained workspace-only sandbox writes with skill-snapshot denial.
  - Made fixture cleanup recover read-only adapter snapshots left by forced
    termination without weakening evaluator workspace ownership checks.
  - Corrected initial-setup coverage to require a separate historical-audit
    answer before policy or changelog writes.
- Closed final security and manifest-validation review findings:
  - Removed externally supplied `command.exit` assertions while retaining only
    evaluator-owned subprocess argument arrays for Git and fixture setup.
  - Replaced open assertion records with a closed kind union and matching
    per-kind target and expected-value validation in TypeScript and JSON Schema.
  - Denied Claude sandbox reads from `/`, re-allowed only the fixture and its
    read-only skill snapshot, and removed native read tools so Bash reads remain
    under OS sandbox enforcement.
  - Verified with an outside sentinel that the adapter can read the fixture but
    receives `Operation not permitted` for a file outside it.
<!-- Agent: GPT-5 Codex | 07/09/2026 3:39 PM CDT -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:23:26-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:31:35-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T21:05:59-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T21:31:39-05:00" -->

## 2026-07-08

- Added fork activation precedence guidance:
  - Updated `references/fork-maintenance.md` and `README.md` so repo-local
    forks are authoritative over globally installed upstream
    `simple-changelogs` copies.
  - Added eval coverage for deduplicating by the upstream provenance pin,
    avoiding double classification/write/verification, and using explicit
    repo guidance when a harness cannot enforce precedence.
<!-- Agent: GPT-5 Codex | 07/08/2026 12:39 PM CDT -->

## 2026-07-07

- Added a removable one-time backfill sentinel:
  - Added `One-Time Guidance Backfill Notice` instructions to `SKILL.md` with a
    stable hidden marker comment.
  - Updated `references/backfill.md` so the notice is treated as a prompt for
    operator approval, not as automatic permission to rewrite released history.
  - Added eval coverage for prompting, approval handling, completed-backfill
    notice removal, explicit opt-out removal, and leaving the notice in place
    after deferred or incomplete audits.
<!-- Agent: GPT-5 Codex | 07/07/2026 2:48 PM CDT -->

## 2026-07-06

- Added guidance-driven released-history backfill rules:
  - Routed policy/guidance backfill work through `references/backfill.md`.
  - Defined automatic drift repairs for source-to-generated sync, missing
    generated-surface entries, clear public-to-developer note relocation,
    unambiguous metadata alignment, and empty `Unreleased` cleanup.
  - Defined permission-gated edits for released note deletion, material
    customer-facing rewording, entry collapsing, release boundary changes,
    small public outcome removal, and ambiguous reclassification.
  - Added eval coverage so future skill edits preserve the operator-permission
    gate for destructive or meaning-changing released-history cleanup.
<!-- Agent: GPT-5 Codex | 07/06/2026 2:04 PM CDT -->

- Added release-bearing merge reconciliation safeguards:
  - Added a required merge workflow checklist to
    `references/release-lifecycle.md` so agents inspect target-branch
    `Unreleased` entries before and after release-bearing merge batches.
  - Updated final verification guidance to require an explicit final statement
    about whether `Unreleased` is empty or intentionally still pending.
  - Added eval coverage for the exact failure mode where an agent opens focused
    pull or merge requests, merges them into a public default branch, and misses
    existing target-branch `Unreleased` entries.
<!-- Agent: GPT-5 Codex | 07/06/2026 11:05 AM CDT -->

- Tightened copy-change classification:
  - Added SKILL and `entry-classification.md` guidance that obvious visible
    copy edits are excluded from `CHANGELOG.md` by default unless the wording
    itself materially changes access, legal/compliance, payment identity,
    safety/trust, or durable capability behavior.
  - Extended the routine-copy eval expectations so modal, helper, placeholder,
    label, and marketing copy changes do not regress into customer-facing
    changelog noise.
<!-- Agent: GPT-5 Codex | 07/05/2026 11:30 PM CDT -->

- Added fork-sync maintenance support:
  - Added `references/fork-maintenance.md` and routed downstream fork creation,
    editing, and sync tasks to it from `SKILL.md`.
  - Added `scripts/check-fork-sync.sh` to read a fork provenance pin and report
    upstream skill commits and changed files since that pin.
  - Added README and eval coverage for fork provenance pins, upstream syncs, and
    preserving intentional fork deltas.
  - Tightened internal release-note filter guidance so mixed parent and nested
    entries are handled separately and checked against the real developer
    changelog vocabulary.
<!-- Agent: GPT-5 Codex | 07/05/2026 8:01 AM CDT -->

- Refactored the skill body for progressive disclosure:
  - Shortened the frontmatter description to trigger and negative-trigger
    conditions.
  - Reduced duplicated customer-impact, public-detail, and final-verification
    prose in `SKILL.md`.
  - Added `references/automation-verification.md` as the single exhaustive
    final-review and checkable-rule reference.
  - Added eval coverage for skill maintenance regressions around description
    bloat, duplicated reference rules, and checklist drift.
<!-- Agent: GPT-5 Codex | 07/04/2026 11:58 AM CDT -->

- Updated `SKILL.md`, `references/release-note-surfaces.md`, and `EVAL.md` so
  release prep defaults to creating or wiring a visible release-note surface for
  apps with returning users when no equivalent exists, while explicitly avoiding
  duplicate surfaces when a reachable equivalent already exists.
- Moved the distributable skill into `skills/simple-changelogs/` and updated
  manual install docs so Skills CLI installs include `EVAL.md` and
  `references/` alongside `SKILL.md`.
- Clarified Skills CLI install docs so default-branch installs use the simple
  source URL and branch or tag installs use an explicit `.git#<ref>` source.
- Added guidance for linking new release-note surfaces from natural app
  locations, preferring clear public-facing React/TSX component names when no
  stronger local convention exists, and keeping a concise top-of-file guidance
  comment on newly created surfaces.
- Added monorepo release-note surface scoping guidance for separate web, mobile,
  admin, developer, dashboard, analysis, and portal surfaces, including internal
  surfaces that pull filtered backend/operations updates from
  `DEVELOPER_CHANGELOG.md`.
- Updated internal release-note surface guidance so UI labels use
  `Release Notes` and parsers skip hidden raw-changelog signature comments when
  rendering from `DEVELOPER_CHANGELOG.md`.
- Added release-note sync guidance and eval coverage so generated customer and
  internal release-note surfaces ignore hidden signature comments before
  rendering.
<!-- Agent: GPT-5 Codex | 07/01/2026 2:41 PM CDT -->
- Added major-release surface guidance so "What's New" modals use summary and
  highlights while a canonical changelog route, docs page, or external release
  source carries full history.
- Added eval coverage for apps that need a real changelog route instead of an
  ever-growing modal archive, including single-action full-changelog linking.
<!-- Agent: GPT-5 Codex | 07/01/2026 3:06 PM CDT -->
- Added release-note depth-budget guidance so auto-shown modals default to the
  latest release, compact manual surfaces cap at readable recent history, and
  full history moves to a canonical route or page.
- Added internal admin/developer guidance and eval coverage for full `Release
  Notes` routes or panels fed from `DEVELOPER_CHANGELOG.md`, with short modals
  linking to the full internal history when needed.
<!-- Agent: GPT-5 Codex | 07/01/2026 3:43 PM CDT -->
- Added release-note modal sequencing and eligibility guidance so auto-shown
  notes wait for auth, returning-user state, and higher-priority gates before
  appearing.
- Added public detail-budget guidance and eval coverage so customer-facing
  changelog, release-page, app-store, email, and in-app "What's New" copy keeps
  clone-enabling mechanics, hidden heuristics, security-control details, private
  vendor details, and roadmap sequencing out of public notes.
<!-- Agent: GPT-5 Codex | 07/01/2026 10:45 PM CDT -->
- Added release metadata sync-audit guidance to `SKILL.md`,
  `references/version-decisions.md`, and `EVAL.md` so released changelog section
  edits require a concrete version map across changelog, release-note,
  app/package, store, and relevant package metadata sources.
<!-- Agent: GPT-5 Codex | 07/02/2026 1:30 AM CDT -->
- Added mobile store release-note guidance to `SKILL.md`,
  `references/release-note-surfaces.md`, `references/version-decisions.md`, and
  `EVAL.md` so App Store, Google Play, TestFlight, internal testing, and
  marketplace notes are scoped to mobile users, respect store constraints, and
  appear in release metadata version maps.
<!-- Agent: GPT-5 Codex | 07/02/2026 1:50 AM CDT -->
- Added explicit pre-release fix guidance to check prior announcements, revise
  still-unreleased entries instead of adding duplicate fix notes, and group
  multiple post-`1.0.0` public fixes under `Bug Fixes`.
- Added `entry-classification.md` guidance for minimum necessary customer
  detail, terse policy/terms/privacy/legal-document notes, major feature launch
  detail, user-facing feature naming, pruning non-product-news changes, and
  provider-neutral pull or merge request source links.
- Tightened first-time feature launch wording so new capabilities use a feature
  name plus what users can now do, reserving `easier`, `clearer`, `better`, and
  `improved` framing for changes to existing flows.
- Added hidden raw-changelog signature guidance for agent edits, including model
  name/version, local timestamp, placement, generated-data exclusions, and
  rendered-public-note constraints.
<!-- Agent: GPT-5 Codex | 06/30/2026 6:50 PM CDT -->
- Added `Superseded` developer changelog guidance for useful obsolete technical
  notes, including when to delete noise, when to preserve replacement history,
  and how to strike through only the replaced claim at the bottom of the same
  release section.
- Added eval coverage for terse policy/terms updates and detailed major feature
  launches.
- Added eval coverage for developer changelog entries superseded by newer
  implementation decisions.

## 2026-06-22

- Restructured `SKILL.md` for progressive disclosure:
  - Replaced the monolithic root instructions with a concise core workflow and a
    task-to-reference loading table.
  - Added `references/backfill.md`,
    `references/entry-classification.md`,
    `references/release-lifecycle.md`,
    `references/version-decisions.md`, and
    `references/release-note-surfaces.md`.
  - Preserved the existing release-finalization, hot-fix, SemVer, and "What's
    New" rules in focused reference files instead of loading all detail for every
    activation.
- Added `EVAL.md` with should-trigger/should-not-trigger queries and behavior
  cases for visible features, developer-only migrations, copy edits, pre-1.0 hot
  fixes, post-1.0 fixes, release-bearing branches, non-release pull or merge
  request prep, and hidden release-note surfaces.
- Tightened the frontmatter description to scope version and deploy-related
  triggers to changelog, release-note, or release version handling.
- Updated `README.md` manual install commands so reference files and `EVAL.md`
  are copied with `SKILL.md`.

- Tightened pre-`1.0.0` customer changelog omission rules in `SKILL.md`:
  - Added explicit guidance to keep embarrassing baseline defects that should
    already work out of user-facing pre-release changelogs.
  - Added examples for omitted pre-1.0 repairs, including broken login,
    checkout crashes, and missing saved data.
  - Updated verification coverage so agents exclude those repairs unless they
    meet the material-impact gate and can be framed without advertising the
    defect.
- Added post-`1.0.0` public bug-fix framing rules in `SKILL.md`:
  - Added examples that convert raw regression, metadata, and query-failure
    descriptions into user-outcome changelog bullets.
  - Added verification coverage to keep blame, embarrassing root causes,
    incident details, and sensitive implementation internals out of public
    changelog and "What's New" copy.
  - Directed maintainer-only root-cause detail to `DEVELOPER_CHANGELOG.md`,
    pull or merge request notes, or incident records.
- Added release-intent and surface-visibility guardrails in `SKILL.md`:
  - Added a release-intent gate before entries move out of `Unreleased`, version
    fields change, or release-note surfaces sync.
  - Split non-release pull/merge request and handoff behavior from release
    finalization behavior.
  - Required local evidence before treating a branch as release-bearing.
  - Tightened version metadata updates so only fields proven to belong to the
    same release flow are changed.
  - Added guidance that named apps, hidden routes, previews, prototypes,
    disabled features, and internal-only tools are not customer-facing without
    evidence of real user or operator visibility.
- Updated `README.md` trigger language to avoid activating the skill for generic
  deploys, commit summaries, or UI work that is not tied to changelog or
  release-note coverage.
- Tightened empty `Unreleased` section handling in `SKILL.md`:
  - Added lifecycle guidance to omit `Unreleased` when no pending entries exist.
  - Added release-finalization guidance to remove empty `Unreleased` headings
    from both changelog files after shipped entries move into a released section.
  - Added verification coverage so agents check that `Unreleased` exists only
    when it contains pending entries.
- Tightened the public `simple-changelogs` lifecycle guidance:
  - Replaced forge-specific release wording with provider-neutral hosted release
    language.
  - Added release-bearing target branch checks for default, production,
    protected release, and direct-consumption public repo branches.
  - Added explicit production/public deployment and later pull/merge request
    reconciliation triggers for moving shipped `Unreleased` entries into
    released changelog, release-note, version, and developer changelog sections.

## 2026-06-21

- Tightened copy-update guidance in `SKILL.md`:
  - Added frontmatter and customer changelog rules that exclude routine copy,
    typo, grammar, tone, label, placeholder, and microcopy edits unless they
    materially change user understanding, access, trust, legal/compliance
    meaning, pricing, setup, or error recovery.
  - Added a verification check for copy-only customer changelog bullets.
- Tightened the changelog entry lifecycle guidance in `SKILL.md`:
  - Added default-branch release guidance for public skill repos, package docs,
    static changelog pages, and release-note data consumed directly from the
    branch.
  - Clarified that shipped entries should be moved out of `Unreleased` before
    pushing, merging, publishing, or deploying.
- Tightened the `Release Notes And What's New` guidance in `SKILL.md`:
  - Added explicit hierarchy rules so headline capabilities group above narrow
    fixes in app "What's New" surfaces and public release-note pages.
  - Added a verification check that major feature groups stand out above minor
    fixes before finalizing changelog or release-note work.
- Tightened the `Customer Changelog` and hot-fix guidance in `SKILL.md`:
  - Added explicit exclusion language for narrow visual hot fixes unless they
    affect durable capability, trust/safety behavior, access, shopping flow, or a
    broadly noticeable UX surface.
  - Updated the frontmatter description and customer impact gate so skill
    triggering and execution both carry the narrower customer-facing threshold.
- Tightened the `Version Decisions` section in `SKILL.md`:
  - Added an explicit rule that elapsed time, date changes, branch duration, and
    commit count are batching context only, not version bump signals.
  - Replaced the short SemVer bullets with a more detailed patch/minor/major
    rubric based on user impact, compatibility, contract changes, migrations,
    and product direction.
  - Added pre-1.0-specific guidance for when to use `0.x.y` patch bumps,
    `0.(x+1).0` minor bumps, and `1.0.0`, while deferring to repo policy for
    teams that model pre-1.0 breaking boundaries differently.
- Updated `README.md` to describe smart version bump decisions as a core skill
  behavior.

## 2026-06-18

- Expanded release version tracking guidance in the `simple-changelogs` skill:
  - Agents now search for affected app, package, and release-note version fields
    during explicit version-tracking or release-prep work.
  - Added guidance for repos that use independent release systems such as
    deployment metadata, EAS/build numbers, Changesets, or package-specific
    version flows.
  - Final summaries now need to explain changed, already-aligned, and
    intentionally skipped version fields.
- Updated README phrasing from Cursor-specific skill language to agent-neutral
  language while preserving Cursor as one install example.
- Added explicit Codex, Claude Code, Cursor, and all-agent install examples to
  the README, plus common manual install paths.
- Fixed README code spans and command blocks after the root-level `SKILL.md`
  flattening so the public docs no longer omit file names, runners, or copy
  paths.
- Tightened the version-tracking instructions so agents own local version
  alignment and only escalate for unclear SemVer/surface decisions, source-of-
  truth policy, release timing, or missing remote credentials.

## 2026-06-17

- Published the skill in the canonical Skills CLI catalog layout:
  - Moved the skill to `skills/simple-changelogs/SKILL.md`.
  - Added README install commands for `bunx skills add` and `pnpx skills add`
    from the hosted repository URL.
  - Verified the Skills CLI can discover the skill from the public hosted
    repository.
- Added bootstrap and git backfill guidance:
  - Documented how agents should create missing `CHANGELOG.md` and
    `DEVELOPER_CHANGELOG.md` files.
  - Added release-boundary, paginated-history, and batching instructions for
    backfills.
  - Added guidance to summarize outcomes instead of copying one entry per
    commit.
