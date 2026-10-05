# Changelog

## Unreleased

- **Release handoff**
  - When the release version is already settled, chosen automatically or by
    your direction, the classification step now returns that exact version
    instead of only a neutral result. Preparing and verifying the changelog
    are still separate later steps, and a version that still needs your
    answer is still returned as a decision for you.
<!-- simple-changelogs-signature agent="Claude Opus 5.5 xhigh" at="2026-10-05T13:48:48-05:00" -->
- **Fork maintenance**
  - The fork checker has a new `--pin-parity` mode that compares a fork with
    the exact upstream version its pin names. It finds upstream content the
    fork never received, including sections added before the pin that an
    earlier sync skipped, so a pin can no longer claim a fork is more current
    than it is.
  - Forks list their intentional differences in a Current Deltas table in
    `references/fork-maintenance.md`: a changed file, an upstream file the
    fork leaves out, or one section a changed file leaves out. The check flags
    rows that no longer match the fork, so the list stays accurate.
<!-- simple-changelogs-signature agent="Claude Opus 5.5 xhigh" at="2026-10-05T12:42:15-05:00" -->
- **Writing style**
  - New changelog entries and release-note lines no longer use em-dashes.
    They use commas, colons, periods, or parentheses, and a sentence that
    reaches for a dash is rewritten rather than having the character
    swapped. A repository's documented house style still wins, and released
    entries keep their wording.
  - Setup and update questions now show each choice as
    `**Choice (Recommended)**: consequence`. The choices and their defaults
    are unchanged.
  - Guidance moves to 23 (full), 21 (web and web+CMS), 20 (mobile), 14
    (skill-maintainer), and 6 (CMS). The update notice needs no backfill.
- **Choosing a distribution**
  - Each distribution's description is shorter and opens with what it
    maintains, then names the repository choice that selects it, so agents
    read less to decide which distribution applies.
- **publish-skill**
  - `publish-skill` now runs only when you type `/publish-skill`; agents no
    longer start a fork publication on their own. It is marked internal and
    is no longer part of the public install instructions.
  - It now also finds global skill installs under `~/.agents/skills`,
    `~/.codex/skills`, `~/.claude/skills`, and `~/.cursor/skills`, and can
    update each fork in its own agent when the host runs parallel agents. It
    matches the copy that ships with Simple Changes.
<!-- simple-changelogs-signature agent="Claude Opus 5.5 xhigh" at="2026-10-05T10:50:54-05:00" -->
- **Version numbers**
  - Setup now finds every app in large repositories that hold several apps.
    It used to stop scanning early and could miss the web app, so the
    question about keeping version numbers in sync never appeared. It now
    looks for web apps in `apps/*`, and for mobile and desktop apps in the
    repository root, `apps/*`, and `packages/*`, and no longer mistakes
    copies inside worktrees or build folders for apps.
<!-- simple-changelogs-signature agent="claude-fable-5-1" at="2026-10-02T22:52:43-05:00" -->
- **Version numbers**
  - Apps released together now take exactly the same number, written the
    same way everywhere: `1.0` beside `1.0.0` no longer counts as a match.
    Under one shared counter, an app that releases after another app already
    took the newest number moves on to the next number instead of reusing it.
  - Release tools on Simple Changes 0.23.0 or later now receive the shared
    number, and the list of apps released together, as structured fields.
    Tools on older versions keep working exactly as before; nothing changes
    for them.
<!-- simple-changelogs-signature agent="claude-fable-5-1" at="2026-10-02T19:36:06-05:00" -->
- **Version numbers**
  - Repositories on the full distribution that ship several apps from one
    codebase, such as web, iOS, Android, and desktop, can now keep their
    version numbers in sync. Setup finds the apps and asks one question with
    three plain choices: separate numbers per app; the same number everywhere,
    where an app that is behind catches up (Web ships 1.0, so the next Mobile
    release is 1.0); or one shared counter, where every release takes the next
    number and apps that did not ship skip it. The answer is saved in
    `.simple-changelogs.json` as `sharedVersionLines`.
  - Repositories already on the full distribution with several apps are asked
    that question once, during the Guidance 22 update. Nothing is renumbered.
  - Release notes still describe each app's real changes. A Mobile release
    made of fixes that catches up to 1.0 is written as fixes, not as a major
    release.
<!-- simple-changelogs-signature agent="claude-fable-5-1" at="2026-10-02T17:49:35-05:00" -->
- **History queries and checks**
  - `query.ts` no longer skips changelog entries or whole releases that carry
    an HTML comment on the same line as a bullet or heading, a `<!--` inside
    inline code, or an indented code block. Such lines used to be read as
    comments, the hidden entries vanished from `releases`, `show`, and
    `entries`, and `check` still passed. No affected repository was found:
    none had adopted curated notes or placed an inline comment on a bullet or
    heading. An unclosed comment or code block is now reported as a
    diagnostic instead of swallowing the lines after it.
  - Curation checks run only when the repository has opted into curated
    release notes; otherwise an existing `RELEASE_NOTES.md` only earns a note.
    Under a curated policy, `check` now catches a section whose release or
    source does not match its heading, a highlight bullet without exactly one
    highlighted entry, and two sections bound to the same release. Breaking
    and Security changes are recognized regardless of case, in nested
    bullets, and through group or section names, and a release with fewer
    entries than the highlight minimum is no longer failed for being thin.
  - `query.ts --help` exits 0, `show v1.3.0` resolves, `--omitted` implies the
    customer log, and `## Unreleased (targeting 1.5.0)` reads as Unreleased
    with a diagnostic.
- **Setup**
  - Two setup updates applied at once can no longer silently discard a
    confirmed change: the later run is blocked and asked to inspect again and
    retry. A setup write interrupted part-way is rolled back on the next
    write-mode run instead of blocking every later update; a transaction left
    by an older helper version still blocks, now with exact remediation.
  - Post-onboarding updates, guidance acknowledgments, and audit completion
    stop before writing when inspection reports a distribution conflict or a
    malformed policy, and acknowledging one guidance track never lowers the
    other.
  - A CMS policy must record a `guidance.version` of at least 1 everywhere it
    is validated, numeric setup flags accept only plain decimal integers, and
    a curation budget of `{min: 0, max: 0}` stays valid (every curated release
    is rollup-only).
  - Web+CMS update notices now explain what the CMS-track guidance adds
    (curated highlights on CMS entries) instead of only naming a version.
- **Curated release notes**
  - The mobile distribution asks about curated notes only when an in-app
    release-notes surface or store "What's New" metadata already exists, and
    recommends them there because store fields are length-limited; the
    skill-repository distribution asks only when the package has a published
    release-note destination. Both map curated highlights to those surfaces
    and keep `CHANGELOG.md` as the complete record; neither mentions marketing
    or archive pages.
- **Installation and project docs**
  - The README now recommends installing from the GitHub mirror, where
    `skills update` works, shows the current Web guidance version in its
    example policy, describes the mobile-placement question as conditional,
    and links the Apache-2.0 license and the new `NOTICE`. Security and
    conduct reports go through a confidential GitLab issue; the mirror is
    read-only.
  - The fork-maintenance reference states that the checker path's leading
    segment is the distribution's own package directory
    (`skills/<distribution>` in an upstream checkout, the install directory
    once installed), so the example is no longer resolved against a
    repository root where the script does not exist.
<!-- simple-changelogs-signature agent="claude-fable-5-1" at="2026-10-02T14:32:02-05:00" -->
- **Release reconciliation**
  - Release-bearing work now carries the core workflow as a checklist in the
    agent's reply, and verification repeats until `query.ts check` and the
    repository's own checks pass, returning to the step that needs the fix
    instead of handing off on a failure. Ordinary changelog edits skip the
    checklist.
- Every distribution now states its requirements up front: Git, Bun 1.3 or
  later for the bundled helpers, and a POSIX shell for the fork checker. A
  missing requirement is reported rather than worked around by hand. Each
  skill also declares the models it is written for, Claude Opus 5.5 and Claude
  Fable 5.1, in its frontmatter.
- Long references now open with a contents list of their sections, so agents
  reach rules late in a file without reading all of it first.
<!-- simple-changelogs-signature agent="claude-opus-5-5" at="2026-10-02T13:46:00-05:00" -->
- **Release reconciliation**
  - After a release is reconciled, both changelogs now keep an empty
    `## Unreleased` heading instead of removing it, so the next merged change
    lands under Unreleased rather than inside the newest released section.
  - The bundled `query.ts check` accepts that empty heading, reports a
    duplicate `Unreleased` heading as a problem, and notes when `Unreleased`
    is not the first release heading.
  - Repositories updating to this guidance are offered an optional review that
    restores a missing empty heading and reports entries already filed into the
    newest release.
<!-- simple-changelogs-signature agent="Claude Opus 5.5" at="2026-09-30T16:54:26-05:00" -->
- **Skill publishing**
  - Broad publication runs now recognize Web + CMS as the complete changelog
    installation for combined repositories, preventing a redundant standalone
    CMS package from being reinstalled while preserving the protected CMS
    policy.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-09-02T17:54:18-05:00" -->
- **Release handoffs**
  - Release orchestrators now treat schema-digest differences as compatibility
    status instead of blocking a handoff; an unsupported request or receipt
    version still blocks safely.
  - `attempt` and `environment` are now optional request metadata, so
    integrations can omit them without changing handoff behavior.
  - CMS-only projects can now participate in delegated changelog handoffs
    through receipt v2: relevant operator changes advance from classification
    to preparation and verification without creating a version, tag, or public
    release note.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-09-02T11:05:06-05:00" -->
- Release orchestrators can now identify an installed Simple Changelogs
  distribution and its capabilities directly, without inferring them from a
  directory name or documentation prose.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-26T09:20:17-05:00" -->
- Public release notes can now be a curated highlights layer separate from
  the full changelog. Repositories that opt in keep `CHANGELOG.md` as the
  complete user-facing record while `RELEASE_NOTES.md` carries three to eight
  one-sentence highlights per release (patch releases may carry fewer, down to
  none) plus one rollup line. Curated notes are always derived from the
  changelog and confirmed inside the existing release receipt; every entry is
  accounted as highlighted, rolled up, or omitted, breaking and security
  changes can never be filtered out, and anything unadvertised stays
  synthesizable from the full history. CMS repositories gain the same
  capability through optional per-release highlights with identical coverage
  rules.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-25T17:13:45-05:00" -->
- Web+CMS repositories now receive CMS-side guidance-update notices, and
  acknowledging an update advances both recorded guidance checkpoints together.
- Settings updates after onboarding are now fully transactional: an interrupted
  write restores the previous state, and re-applying an identical preference
  reports it as already configured instead of asking for confirmation again.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T15:21:17-05:00" -->
- Shipped changelog history is now directly queryable. Every markdown
  distribution bundles a read-only `scripts/query.ts` helper that lists
  releases, shows one release, filters entries by date, product area, author,
  or text, and lints changelog structure, for humans and agents alike. Both
  the current and the original signature comment formats are recognized, and
  markdown remains the only source of truth.
- Read-only requests can no longer change saved settings: setup invoked in
  read mode now declines audits, guidance decisions, and preference updates
  instead of writing them.
- CMS repositories configured with a release-notes component preference now
  validate cleanly; the bundled validator previously rejected a setting that
  setup itself had written.
- Mobile-only onboarding no longer offers to build web release-note pages;
  web destinations are routed to the distributions that own them.
- The project is now formally open source under the Apache-2.0 license, with
  contribution, security, and conduct guidelines included.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T12:30:43-05:00" -->
- Delegated release handoffs from Simple Changes now negotiate successfully
  again: the bundled protocol schemas were refreshed to the current
  consumer-owned versions, so capability negotiation no longer fails with a
  schema-digest mismatch, and both current and previous receipt formats are
  accepted.
<!-- simple-changelogs-signature agent="claude-fable-5" at="2026-08-24T11:54:37-05:00" -->
- Release notes now group related changes under user-recognizable product or
  skill areas by default, merging repeated areas while leaving single-item
  categories flat. Patch releases always use **Bug Fixes & Improvements** as
  the release title with one flat bullet list.
- During onboarding, owners choose whether stable major releases receive a
  concise descriptive name beside the canonical version. Names default on,
  remain reviewable presentation, and never replace the version; minor releases
  require no name.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-22T14:10:32-05:00" -->
- Install and update reports now identify the Simple Changelogs source by Git
  ref or commit when known, then name the selected distribution and its
  guidance checkpoint. Guidance numbers are distribution-specific behavior
  checkpoints—not package versions, family-wide release numbers, or source
  revisions.
- Publishing now updates compatibility-symlink installations through their real
  package target and preserves the links, so one physical installation is
  refreshed once instead of being skipped or counted as a duplicate.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-20T16:27:21-05:00" -->
- Recommended setup is now a true one-answer path: it explains the repository
  in everyday language, shows one evidence-backed setup receipt, and asks only
  for confirmation or requested changes. The guided path also defines unfamiliar
  terms when they first matter and asks questions in dependency order, so
  destination details appear only after the destination itself is chosen.
  Confirmation receipts lead with consequential choices and offer **Confirm**,
  **Show details**, or **Change something**; the full receipt remains available,
  and hidden details never expand setup's authority.
- Setup now reports whether each Web, Mobile, app-store, CMS, or workspace
  surface was detected, not detected by a complete scan, or remains uncertain.
  Irrelevant Mobile questions are hidden only when the scan can support that
  conclusion; otherwise setup asks one combined product-shape question instead
  of presenting every possible branch.
- Web archive setup is now two plain-language questions. First, **Should I build
  a Release Notes page?** defines it as the complete history of shipped updates,
  offers a dedicated page, an existing page, or no page, and reassures owners
  that building it does not automatically show it live. Then **Who should see
  Release Notes?** maps developers, preview reviewers, and live visitors to the
  environments where the page appears.
- Public-version setup now explicitly offers automatic patch releases while
  asking for minor and major releases, alongside the existing granular choices,
  and illustrates patch, minor, and major changes with `1.5.0` examples. Normal
  first-time setup no longer asks for standing authority to add hypothetical
  future release-note UI; it asks about the exact surface when one is actually
  needed, while advanced `allow` and `existing-only` policies remain supported.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-20T14:41:13-05:00" -->
- Setup now starts by showing what the repository actually contains—Web,
  Mobile, app-store, CMS, workspace, and existing release-note candidates—then
  offers a complete guided walkthrough of the applicable workflows and choices.
  Established destinations are reused; missing destinations are proposed, never
  assumed, and require confirmation before creation.
  - After owners choose destination types, setup checks again and explicitly
    confirms every existing, missing, or planned surface. Owners can approve the
    plan or revise their choices, and a preference never substitutes for evidence
    that a product, route, authentication flow, credential, or monorepo exists.
  - Full repositories can now keep mobile-specific history in app stores only,
    in the Mobile app and stores without Web presentation, or also publish it on
    one tabbed or two separate Web Release Notes pages.
  - Installed-guidance notices retain the plain-language walkthrough, unchanged
    settings and history assurance, detailed release-note option, and separate
    conditional historical-review decision.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-14T18:32:57-05:00" -->
- Internal-only, developer-only, preview, staging, and developer-experience
  changes no longer prompt for an unused public version.
<!-- simple-changelogs-signature agent="gpt-5.6-sol medium" at="2026-08-12T10:57:32-05:00" -->
- Simple Changes release handoffs can once again verify Simple Changelogs
  compatibility reliably: producer capability schema digests now use canonical
  JSON, and negotiation advertises only shared protocol features.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-11T16:59:16-05:00" -->
- Setup inspection now explains when installed guidance is newer than a
  repository's recorded guidance, summarizes material changes and backfill
  relevance, and offers detailed skill release notes. Agents surface the notice
  before write work, never run a backfill automatically, and ask only when
  released history may benefit.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-10T18:07:47-05:00" -->
- Added public release version controls for skill repositories and product
  distributions:
  - Repositories can independently require approval or allow automatic selection
    for patch, minor, and major public versions. Policies without the field
    safely ask for every bump and suggest the exact next version.
  - Ordinary work stays under `Unreleased` until a proven public release
    boundary. Exact current direction takes precedence, and version approval
    never grants merge, deployment, publication, store, migration, secret,
    environment, or DNS authority.
  - Release orchestrators can now negotiate a closed classify, prepare, and
    read-only verify handoff. Per-train receipts bind decisions to the exact
    policy and target, distinguish normal approval from operational failures,
    and keep a prepared release pending until verification proves integration.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-10T17:41:26-05:00" -->
- Release notes can now include contextual links to the exact product route or
  screen for a released feature. During setup, owners choose **Link when useful**
  (recommended), **Ask before linking**, or **No feature links**, with a compact
  diagram explaining each path.
- A discovered route remains a candidate until it ships in the same release and
  matches the note’s audience, authentication, role, tenant, feature flag,
  platform, and environment. Structural links between summaries and release
  archives remain available. The preference applies to full, Web, Mobile, and
  Web+CMS repositories, but not CMS-only or skill repositories.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-09T02:28:39-05:00" -->
- Setup now walks owners through every unresolved preference as one
  plain-language, numbered multiple-choice question at a time. Each option
  explains the outcome, marks the recommendation, says what setup will save or
  change, and names the important tradeoff; compact diagrams make audience,
  environment, data-flow, and write-scope differences easier to compare.
- Approved public Web Release Notes can now appear in all environments, in local
  development and recognized previews only, in production only, or nowhere.
  One choice controls the complete surface: the route or page, navigation and
  manual links, compact summaries, and automatic modal. Local and preview only
  is recommended for marketing and client sites, where production does not
  serve the route or expose an entry point. Unknown scoped environments hide
  the surface safely, while changelog generation, archive-data synchronization,
  deployment, and publication remain independent.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-08-09T00:39:40-05:00" -->
- Version fields are now read by role instead of compared as one flat set. A
  canonical release version owns chronology for a release train, public app
  versions mirror it, and build numbers, version codes, and development
  identifiers are tracked as linked release evidence. A public version or SemVer
  bump is never derived from a build number.
- A single repository can hold several independent release trains. Mobile on
  3.2.0 while Web is on 6.7.0 is no longer treated as version drift, releasing
  one product no longer bumps another to match, and two fields that happen to
  hold the same string are not assumed to be joined. When several public version
  owners exist and the relationship is genuinely unclear, setup asks once whether
  surfaces are shared, independent, or mixed, records the answer, and reuses it.
  Until that answer exists, version fields, tags, and released headings are left
  untouched.
- App Store and Play Store descriptions are now tied to the submitted public
  version even when their files hold only prose, and keep build numbers, version
  codes, CI identifiers, and internal prerelease suffixes out of public copy.
  Optional release names such as “Summer Update” may appear beside a version on
  an established surface without ever replacing the canonical value.
<!-- simple-changelogs-signature agent="Claude Opus 5" at="2026-07-29T17:07:03-05:00" -->
## 2026-07-30

- Release-note surfaces now use sparse emphasis for named product terms such as
  app surfaces, core components, filters, categories, and formats. Feature
  summaries stay focused on the capability and practical outcome instead of
  cataloging every supported control or interaction detail.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-30T16:05:31-05:00" -->

## 2026-07-27

- Web production deployments now count as product releases. Every change
  included in the target must be assigned to a dated, versioned release and
  integrated across established changelogs, release-note mirrors, and product
  version metadata before production. Unresolved versions or unmerged
  reconciliation block deployment; exact already-reconciled retries reuse
  their release, and earlier violations are repaired forward.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T22:04:07-05:00" -->

- Publishing now distinguishes preserved baseline state from active external
  work. Dirty or unrelated original checkouts and pre-existing worktrees,
  commits, or proposals stay untouched but do not block publication through an
  independent remote-default worktree. External ownership requires new activity
  observed after the baseline or a live claim on the exact target; ownership is
  rechecked before mutation, exact handoff is still required for active work,
  and finished reports separate published results, preserved baseline details,
  and genuinely outstanding targets.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T09:13:11-05:00" -->
- Across all six packaged distributions, onboarding now asks before adding a
  short Simple Changelogs pointer to an existing agent-instruction file such as
  `AGENTS.md` or `CLAUDE.md`. It follows the scope you already picked: a
  per-repository setup offers that repository's instruction file, while an
  all-projects setup offers your global one, so a single instruction file is
  updated once instead of once per project, and a run-only setup writes nothing.
  A global pointer names no specific changelog tool, so it stays correct in
  projects that use a different one. The pointer records when the changelog
  decision is due, requires the outcome even when no entry is needed, and names
  the owning distribution without copying its rules; rerunning onboarding
  updates an existing pointer in place.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:42:34-05:00" -->
- Publishing now preserves branches, worktrees, and merge or pull requests
  owned by another active agent, task, or person. Broad requests to ship,
  integrate, or prune do not transfer that ownership: mutation requires an
  exact explicit handoff, ownership is rechecked immediately beforehand, and
  preserved work is listed with the authority still needed.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:11:26-05:00" -->
- Setup now always offers release-note archive and latest-release surface
  choices in full, web, mobile, web+CMS, and CMS-only repositories, even when
  no candidate route exists; declining leaves product and operator UI
  unchanged.
- Existing component systems are detected and kept automatically. Otherwise,
  setup asks once whether to use the named Web or native recommendation,
  preserve existing Radix primitives, choose another library, or add no
  component dependency. The confirmation receipt names every dependency and
  separately lets users seed approved archives from complete eligible history,
  choose a narrower scope, or decline seeding.
- Bundled Web, mobile, and operator design guidance now covers presentation,
  theming, accessibility, responsive containment, reduced motion, long and
  empty histories, and server-rendering defects for every authorized surface.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T01:38:30-05:00" -->
- App onboarding now treats Updates, News, Blog, Announcements, and
  release-note-named routes as candidates to verify instead of assuming they
  are release archives. First-time apps can choose a Release Notes tab or
  section, a dedicated Release Notes page, or no archive, while returning-user
  apps can separately opt into an automatic latest-release modal linked to the
  archive. Customer-facing destinations default to “Release Notes”; protected
  developer, admin, and operator history defaults to “Changelog” unless product
  evidence or the user selects another name.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T00:26:33-05:00" -->
- Recommended onboarding now includes a comprehensive initial backfill of every
  historic change from the oldest trustworthy evidence through setup across all
  six Simple Changelogs distributions. The final history question offers only
  defer or decline opt-outs, and confirming the setup receipt starts the
  default without separate “Review it now” approval.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T23:37:21-05:00" -->
- First-time setup now offers a short recommended or customized onboarding
  conversation, records confirmed repository or solo-developer preferences,
  leaves read-only work untouched, and resumes the original changelog task
  after setup.
- The full distribution now asks where mobile-specific release history belongs
  on the web and derives independently scoped Web and Mobile feeds from one
  canonical history, without treating that placement choice as permission to
  create new product UI.
- Publishing now treats compatibility paths that resolve to the same physical
  skill package as one installation, avoiding false duplicate-install warnings
  while retaining every logical alias in the inventory.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T16:16:12-05:00" -->
- Setup now records the current guidance version for each selected distribution,
  and the full distribution requires an explicit mobile release-note placement
  before writing repository policy.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T17:15:35-05:00" -->
- Publishing a skill update now reaches every local install of that skill
  instead of one chosen validation repository. The workflow discovers each
  consumer, applies its retention mode, and reinstalls consumers concurrently
  so a single failure no longer hides the others.
<!-- simple-changelogs-signature agent="Claude Opus 5" at="2026-07-25T11:40:26-05:00" -->
- Release-note curation now uses stable, scoped presentation maps that preserve
  chronological changelogs as the source of truth, record continuation and
  overlapping revisit history, and prevent completed reorganizations from
  silently dropping or duplicating notes.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-24T00:39:25-05:00" -->
- Simple Changelogs now offers six mutually exclusive distributions: full,
  CMS-only, web-only, mobile-only, web+CMS, and the lean
  `simple-changelogs-skill-maintainer` distribution for repositories that
  develop or publish agent skills. Repository policy and install metadata select
  one owner so overlapping changelog workflows stop before writing.
- Each selected distribution is now self-contained and approximately 24–87 KB,
  with package-shape and real Skills CLI consumer checks verifying the installed
  boundary.
- The CMS-only distribution now includes the current upstream behavior while
  retaining its runtime validator, and fork synchronization follows each fork's
  provenance to compare the correct upstream distribution.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T20:53:07-05:00" -->
- The evaluation package now supports Grok Build as an optional runtime, with
  isolated execution and the same provider-neutral response contract used by
  other adapters.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T18:01:31-05:00" -->
- Durable UI and interaction polish now stays in the full customer changelog
  when it provides useful product history, while compact release-note surfaces
  continue to show only material highlights.
<!-- simple-changelogs-signature agent="Codex" at="2026-07-16T12:48:48-05:00" -->
- Skill updates can now be published end to end through maintained forks and a
  real consumer installation, with package integrity and merged release state
  verified before completion.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-16T12:52:00-05:00" -->
- Changelog setup now keeps one portable `.simple-changelogs.json` policy in
  each repository, reuses clear audit permission from the current request, asks
  only when the choice remains open, and never records an unanswered setup
  choice.
- New release-note modals, routes, screens, panels, and navigation links now
  require an explicit request or documented repository permission. One-off
  answers do not silently become an ongoing repository preference.
- Version guidance now distinguishes SemVer's `0.x` initial-development phase
  from prerelease versions that use a suffix such as `-beta.1`.
- Fork maintenance now ships with the skill and reports current, behind,
  invalid, and divergent provenance pins consistently.
- A runnable, provider-neutral evaluation package now checks contracts and
  isolated behavior through optional or third-party adapters, rejects
  caller-supplied command execution, and constrains bundled model adapters to
  their temporary fixtures.
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:23:26-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:31:35-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T21:31:39-05:00" -->
- Repository policy now supports single-changelog repositories and optional
  attribution:
  - `developerChangelog: "optional"` keeps only `CHANGELOG.md` and preserves
    technical context in commit or merge-request descriptions instead.
  - `signatures: "none"` disables signature comments for a repository, and a
    signature is never written when neither the agent identity nor the
    timestamp is actually available.
- Installed packages no longer contain extra discoverable `SKILL.md` files:
  evaluation fixtures now store theirs as `SKILL.fixture.md`, so recursive
  skill loaders cannot mistake a test decoy for the real skill.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T08:59:29-05:00" -->
- Added major-release guidance (guidance version 3):
  - `1.0.0` notes now curate the durable product established during public
    `0.x` development, while later majors summarize the transition from the
    prior stable line, including breaking changes and required migration.
  - Next-major branches, integration-branch merges, and alpha, beta, or
    release-candidate versions are no longer mistaken for the stable major
    release, and published prerelease history stays intact.
  - Prerelease detection now follows the repository's published convention,
    including PEP 440 versions such as `2.0a1`, not just SemVer suffixes.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T14:12:57-05:00" -->

## 2026-07-08

- Clarified fork activation precedence:
  - Repo-local forks of this skill should supersede globally installed upstream
    `simple-changelogs` copies for that repo.
  - Agent harnesses should deduplicate by the fork provenance pin so the local
    fork and global upstream skill do not both classify or write changelog
    updates for the same task.
  <!-- Agent: GPT-5 Codex | 07/08/2026 12:39 PM CDT -->

## 2026-07-07

- Added one-time guidance backfill prompts:
  - Skill updates can now ship with a removable notice that asks whether to
    audit and update existing released changelogs and release-note surfaces
    against the new guidance.
  - The notice is removed after an approved, completed backfill or an explicit
    opt-out, while deferred or incomplete audits remain visible for the next
    changelog task.
  <!-- Agent: GPT-5 Codex | 07/07/2026 2:48 PM CDT -->

## 2026-07-06

- Added guidance-driven backfill guardrails:
  - Agents now distinguish safe drift repairs from destructive or
    meaning-changing released-history edits.
  - Existing released notes can be synced, filled from source, or moved between
    public and developer surfaces when information is preserved, while deleting,
    materially rewording, collapsing, or changing release boundaries requires
    explicit operator permission.
  <!-- Agent: GPT-5 Codex | 07/06/2026 2:04 PM CDT -->

- Tightened release-bearing merge guidance:
  - Agents now get an explicit merge reconciliation checklist for public default
    branches and other release-bearing targets.
  - The skill now warns that a generic changelog check can pass while
    `Unreleased` still needs to be moved into a released section.
  <!-- Agent: GPT-5 Codex | 07/06/2026 11:05 AM CDT -->

- Clarified visible-copy changelog pruning:
  - The skill now tells agents that visible wording, labels, helper text,
    modal text, marketing copy, and tone polish do not need customer-facing
    changelog entries merely because users can see them.
  - Copy changes still get customer notes when the wording materially changes
    access, legal/compliance promises, payment or shopping identity behavior,
    safety/trust requirements, or durable user capabilities.
  <!-- Agent: GPT-5 Codex | 07/05/2026 11:30 PM CDT -->

- Improved fork maintenance guidance:
  - Forked project skills now get a documented provenance pin so upstream
    improvements can be reviewed and ported without overwriting intentional
    project-specific behavior.
  - Added a helper workflow for checking whether a downstream skill fork is
    behind upstream.
  - Internal release-note filters now get clearer guidance for preserving
    matching nested details and auditing dropped developer changelog entries.
  <!-- Agent: GPT-5 Codex | 07/05/2026 8:01 AM CDT -->

- Improved skill maintenance guardrails:
  - The skill now keeps detailed changelog rules in focused references so agents
    load a shorter `SKILL.md` body for routine changelog work.
  - Final verification now has a dedicated automation reference for checkable
    rules such as empty `Unreleased` sections, hidden signature comments, and
    release metadata alignment.
  - Eval coverage now guards the skill against overlong descriptions,
    duplicated reference rules, and checklist drift.
  <!-- Agent: GPT-5 Codex | 07/04/2026 11:58 AM CDT -->

- Improved "What's New" surface handoff guidance:
  - Skills CLI installs now package the skill from `skills/simple-changelogs/`
    so supporting eval and reference files ship with the skill.
  - Install docs now call out the default-branch install command and the
    explicit Git ref form for branch or tag installs.
  - Release prep now defaults to adding a visible in-app release-notes or
    "What's New" surface for apps with returning users when no equivalent
    surface already exists.
  - Existing reachable release-note surfaces are updated instead of duplicated.
  - Monorepos now get clearer guidance to keep web, mobile, admin, developer,
    and portal release-note surfaces scoped to their own audiences.
  - Mobile-only release notes now default to a mobile modal, sheet, route, or
    screen instead of being crowded into a web What's New modal.
  - Existing admin, developer, dashboard, analysis, and portal areas can now get
    one internal release-note surface that pulls filtered backend and operations
    updates from `DEVELOPER_CHANGELOG.md`.
  - Internal admin/developer release-note surfaces now use `Release Notes` as
    the visible UI label and ignore hidden agent signature comments when
    rendering from `DEVELOPER_CHANGELOG.md`.
  - Release-note sync guidance now tells agents to ignore hidden signature
    comments before rendering generated customer-facing or internal release
    notes.
  <!-- Agent: GPT-5 Codex | 07/01/2026 2:41 PM CDT -->
  - Major-release "What's New" surfaces now favor a concise summary,
    scannable highlights, and one clear full-changelog action.
  - Apps without an existing public changelog source now get guidance to add a
    real changelog route or page for full history instead of using one growing
    modal as the archive.
  <!-- Agent: GPT-5 Codex | 07/01/2026 3:06 PM CDT -->
  - Release-note modals now get a content-depth budget: latest release by
    default, current major or last few short releases only while readable, and a
    full changelog route for older history.
  - Internal admin/developer release notes now prefer a dedicated `Release Notes`
    route or panel for full technical history while keeping any admin modal
    short.
  <!-- Agent: GPT-5 Codex | 07/01/2026 3:43 PM CDT -->
  - Auto-shown release-note modals now wait until after higher-priority auth,
    age-gate, consent, onboarding, payment, safety, account-recovery, or
    migration flows.
  - Pre-release fix guidance now tells agents to check whether the affected
    feature was already announced and revise still-unreleased entries instead of
    creating duplicate fix announcements.
  - Post-`1.0.0` releases with multiple public fixes now group them under a
    `Bug Fixes` heading after larger release-note entries.
  - Customer-facing entries now use the minimum detail needed to communicate the
    change, while major feature launches and workflow overhauls include enough
    detail for users to understand what changed and how to use it.
  - Policy, terms, privacy, and legal-document updates now get terse one-line
    guidance when users only need to know the document changed.
  - Feature launch notes now name the user-facing concept instead of internal
    implementation details, with grouped bullets when several user actions or
    benefits matter.
  - First-time feature launch notes now name the new capability and say what
    users can do, instead of framing a brand-new action as "easier" or
    "improved."
  - Raw changelog edits now get hidden agent signature comments with model and
    timestamp attribution near the changed entry or group.
  <!-- Agent: GPT-5 Codex | 06/30/2026 6:50 PM CDT -->
  - Customer-facing release notes now use a public detail budget that keeps
    clone-enabling mechanics out of public changelogs while preserving enough
    product detail for users to understand major launches.
  <!-- Agent: GPT-5 Codex | 07/01/2026 10:45 PM CDT -->
  - Released changelog sections now trigger a release metadata sync audit so
    release-note data, app/package metadata, store metadata, and relevant package
    versions do not drift silently.
  - Final responses for release-version work now need a concrete version map
    showing which metadata sources were updated, already aligned, or
    intentionally skipped.
  <!-- Agent: GPT-5 Codex | 07/02/2026 1:30 AM CDT -->
  - Mobile store release prep now gets dedicated guidance for App Store,
    Google Play, TestFlight, internal testing, and marketplace release notes.
  - Store release notes now stay mobile-scoped, concise, non-promotional, and
    included in the release metadata version map when store submission is in
    scope.
  <!-- Agent: GPT-5 Codex | 07/02/2026 1:50 AM CDT -->
  - Developer changelog source-link guidance now stays provider-neutral across
    pull and merge request workflows.
  - New release-note surfaces should be linked from a natural app location such
    as a footer, menu, help area, settings, or public changelog page.
  - React or TSX apps without stronger local conventions now get a clearer
    naming nudge toward public-facing release-notes or What's New components.
  - New in-app release-note surfaces now add a short top-of-file comment
    pointing future agents to local changelog, release-note, or "What's New"
    guidance.
  - Developer changelog cleanup now moves useful replaced technical notes into a
    bottom-of-section `Superseded` area instead of leaving obsolete entries mixed
    into active history.
  - Added eval coverage so release prep creates or wires the right visible
    surface, scopes platform/internal notes correctly, sequences modals after
    higher-priority flows, and avoids re-announcing already promised behavior.

## 2026-06-22

- Improved the skill's structure and regression coverage:
  - Detailed backfill, entry classification, release lifecycle, versioning, and
    "What's New" guidance now lives in focused reference files so agents load
    only the detail needed for the current task.
  - Trigger wording now avoids generic deploys, package bumps, commit summaries,
    UI work, and code review unless the task explicitly relates to changelog,
    release-note, or release version handling.
  - Added eval prompts for trigger precision, customer/developer classification,
    hot-fix omission, release finalization, version alignment, and hidden
    release-note surfaces.
  - Manual install docs now copy the reference files and eval prompt pack along
    with `SKILL.md`.

- Tightened pre-1.0 repair omission rules:
  - Agents now avoid advertising embarrassing baseline defects that should
    already work, such as broken login, checkout crashes, or missing saved data,
    as public product news during pre-1.0 releases.
  - Pre-1.0 repair notes now need a material trust, access, safety, payment,
    compliance, onboarding, or durable capability reason before appearing in
    customer-facing changelogs.
- Added public-safe post-1.0 fix wording:
  - Patch release notes now describe user-visible repair outcomes without
    exposing blame, embarrassing root causes, incident details, or sensitive
    implementation internals.
  - Technical context for maintainers is directed to developer changelogs,
    pull or merge request notes, and incident records instead of customer-facing
    changelogs.
- Added release-safety guardrails:
  - Agents now need explicit release intent before moving entries out of
    `Unreleased`, syncing release-note surfaces, or changing version fields.
  - Version synchronization now only applies to fields proven by local repo
    evidence to belong to the same release flow.
  - Hidden, disabled, preview, prototype, and internal-only surfaces no longer
    count as customer-facing release-note surfaces just because code exists.
  - Creating a new in-app "What's New" surface now requires an explicit task or
    documented repo release policy.
- Simplified empty `Unreleased` handling:
  - Agents are now told to omit `Unreleased` entirely when there are no pending
    changes instead of leaving placeholder text.
  - After release finalization, empty `Unreleased` sections are removed from both
    customer and developer changelogs.
  - New pending work recreates `## Unreleased` at the top of the changelog before
    the first released heading.
- Clarified release-finalization triggers:
  - Production and public deployments now explicitly move shipped entries out of
    `Unreleased` before deploying, even when no branch merge is involved.
  - Pull and merge request prep now checks whether existing `Unreleased` entries
    are already on a release-bearing target branch and reconciles them before
    opening new work.
  - Release-bearing branch guidance is provider-neutral, covering default,
    production, protected release, and direct-consumption public repo branches
    without depending on a specific forge.

## 2026-06-21

- Clarified copy-update changelog rules:
  - Routine copy edits, typo fixes, grammar fixes, tone tweaks, label wording,
    placeholder text, and microcopy polish now stay out of customer changelogs
    unless they materially change what users understand, decide, can access,
    must trust, or are legally promised.
  - Copy and content changes now have clearer inclusion guidance for user
    understanding, trust, legal/compliance meaning, pricing, purchase decisions,
    onboarding/setup, error recovery, permissions/access, and support
    obligations.
- Clarified default-branch release boundaries:
  - Public repos that users install, read, or consume directly from the default
    branch now get clearer guidance to treat pushes and merges to that branch as
    shipped releases.
  - Agents are now told to move shipped entries out of `Unreleased` before
    pushing, merging, publishing, or deploying.
- Improved "What's New" hierarchy guidance:
  - Agents are now told to make headline capabilities easier to scan than minor
    updates by grouping major feature bullets above narrow fixes.
  - App release-note surfaces should keep small polish and repair notes lower
    priority so they do not visually compete with launch-level work.
- Tightened customer changelog rules for visual hot fixes:
  - Narrow visual fixes now stay out of customer-facing changelogs unless they
    change a durable user capability, trust or safety behavior, access, shopping
    flow, or a broadly noticeable UX surface.
  - The customer impact gate now asks agents to look for durable or broadly
    noticeable user impact before writing user-facing notes.
- Clarified version bump guidance:
  - Version changes are now based on shipped impact, compatibility, release
    boundaries, and repo policy instead of calendar dates or implementation
    duration.
  - Pre-1.0 projects now get clearer guidance to use minor bumps for durable
    product direction, workflow, public surface, or contract changes without
    treating every significant change as a major release.
  - Patch, minor, major, and pre-1.0 decisions now have clearer criteria that
    should work as defaults while remaining easy for teams to customize.

## 2026-06-18

- Added explicit version-sync guidance:
  - Agents are now told to find and update affected app, package, and
    release-note version fields in the same pass as release changelog work.
  - Repos with independent release policies now get a clear exception for
    deployment IDs, EAS/build numbers, Changesets, and separately versioned
    package flows.
  - Final responses should explain which version fields changed, which were
    already aligned, and which were intentionally skipped.
- Generalized the README wording so the skill is described as agent-neutral,
  while keeping Cursor install commands as examples.
- Expanded the install examples for Codex, Claude Code, Cursor, all-agent CLI
  installs, and common manual skill directories.
- Fixed the README so changelog file names, install commands, and manual copy
  paths render correctly after the root-level skill layout change.
- Clarified that agents should handle routine version tracking themselves when
  release intent and repo policy are clear, escalating only for ambiguous release
  decisions or unavailable remote credentials.

## 2026-06-17

- Added clearer first-run changelog setup:
  - Agents are now told to create `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md`
    when they do not exist yet.
  - Git-history backfills now include guidance for tags, release boundaries,
    batching, and conservative summaries.
- Published the `simple-changelogs` skill for Skills CLI installs from the
  hosted repository.
