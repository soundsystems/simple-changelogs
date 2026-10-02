# Conversational Onboarding

Use this flow only when a write-capable changelog request reaches a repository
without valid policy for the selected distribution. Setup is a checkpoint
inside the original task, not a separate task.

## Contents

- Inspect before asking
- Question presentation contract
- Explain before asking
- First screen
- Customized questions
- Mobile-history placement
- Public-version choice
- Release-note organization and major names
- Public release-note layer
- Contextual product-surface choice
- Component-source choice
- Preference scope
- Repository-instruction pointer
- Final history question
- Confirm, apply, and continue
- CMS branches

## Inspect before asking

Classify the current request and run this distribution's bundled
`scripts/setup.ts` helper. The path below assumes a repository-local
install; for a global install, run the installed skill directory's copy by
absolute path (`bun /absolute/path/to/simple-changelogs/scripts/setup.ts`):

```sh
bun skills/simple-changelogs/scripts/setup.ts inspect \
  --json \
  --task-mode write \
  --repo .
```

Use `--task-mode read` for explanations, classification advice, or previews
that the user explicitly keeps read-only. Those requests never write setup
state. Commit-message drafting and other trigger near-misses are also
read-only. Valid policy suppresses repeat onboarding. Malformed policy is
reported and preserved.

The inspection result provides policy state, detected distribution and
evidence, history counts, release-note-named destination candidates, adjacent
Updates, News, Blog, or Announcements candidates, developer-history evidence,
separate Web, Mobile, store, CMS, and workspace structure evidence,
component-library evidence, scan completeness, per-surface applicability,
global defaults, a recommendation, and unresolved questions. A path name or
dependency is discovery evidence, not proof that a route is reachable,
contains release history, or uses that component stack for product UI. Do not
ask for a choice already established by current instructions, repository
policy, or trustworthy evidence.

Use applicability conservatively: `detected` is candidate evidence to verify;
`not-detected` requires a complete scan with another recognizable product shape
and suppresses detailed questions without claiming absence; `uncertain` means
the scan is incomplete or inconclusive, so ask one plain-language topology
confirmation instead of showing every possible branch. Never exclude a surface
from one missing framework, path, or dependency. Explicit direction wins.

## Question presentation contract

Setup is for the repository owner or product owner, not an implementation
quiz. Explain every unresolved preference in plain language before asking and
present it as a numbered, choose-one list. Each option includes:

- a short outcome label, with **Recommended** on the evidence-backed default;
- what the owner and their users will experience;
- what setup will save or change; and
- the important tradeoff or boundary in one sentence.

Ask one question at a time unless two choices are inseparable. Accept either
the number or the option label. Do not lead with policy field names, enum values,
framework jargon, or an unexplained yes/no prompt; show the stored value only as
secondary detail when it helps an expert verify the receipt.

Assume the owner may be configuring changelogs for the first time. Define terms
when they affect a choice: CMS means the protected staff admin area, archive
means the complete-history page, and modal means an announcement window shown
automatically. Distinguish current changes from preferences saved for later.

Use a compact text diagram when a choice changes audience, environment, data
flow, or write scope. Keep the diagram beside the options it explains and
label both the shown and suppressed path. Skip diagrams for choices whose
effect is already obvious from one sentence.

## Explain before asking

Do not make the owner reverse-engineer the workflow from setup fields. Before
the first choice, explain in plain language:

- Simple Changelogs keeps durable customer outcomes separate from technical
  maintainer history;
- it can start or adopt changelogs, classify current work, prepare and verify a
  release, synchronize established product surfaces, review older history when
  authorized, and explain what changed after a skill update;
- one canonical item may feed several independently filtered Web, Mobile,
  store, CMS, package, or internal destinations without making their audiences
  interchangeable;
- setup records preferences and evidence but does not itself publish, deploy,
  submit a store release, create a hosted release, or rewrite history; and
- the current request continues after setup, so the user never has to repeat it.

Then summarize the concrete evidence: selected distribution and why, existing
customer and developer histories, released-history count, proven and candidate
release-note destinations, version owners, component-system evidence, and the
exact files setup could write. State which choices the current request or
repository already decided, show the recommended defaults, and say that
nothing has been written, backfilled, published, deployed, or submitted yet.

## First screen

Summarize concrete findings and the recommended path, then ask **How would you
like to set up Simple Changelogs? Choose one:**

1. **Use recommended setup — Recommended** — Apply evidence-backed safe defaults. When
  released history exists, include the full backfill and ask last only whether
  the user wants to defer or decline it. This is the one-answer path described
  below.
2. **Walk me through it** — Explain every main workflow, every destination the
  repository may use, and each preference in plain language, one at a time,
  before saving anything.
3. **Customize** — Explain and ask only the unresolved questions below.
4. **Use recommended setup for this run only** — Apply the choices to the current task
  without writing policy; onboarding appears again next time.

The walkthrough first shows how ordinary edits, release preparation, product
surface synchronization, historical review, version decisions, delegated
Simple Changes handoffs, and later skill updates flow from inspection through
verification. For each topic, explain what the skill does automatically, what
still requires a decision, and what authority the choice does not grant. Then
ask the same unresolved owner choices below one at a time. The walkthrough is a
conversation path, not a new stored policy value; a confirmed walkthrough uses
the customized setup style in the receipt.

The recommended path uses a developer history, hidden agent-and-time audit
comments, product-area release-note grouping, named stable major releases, and
`ask` for future missing destinations. Reuse established
release-note destinations. When none exists, recommend a new current surface
only when repository evidence and the actual audience support it; otherwise
recommend canonical changelog files without product UI. A compact summary is
recommended only for an approved archive serving returning users. With no
released history, record `not-applicable`. With released history, include a
comprehensive initial backfill by default and offer deferral or refusal as the
final onboarding choice. Record nothing until the user confirms the setup
receipt.

### One-answer recommended setup

For a quick, one-answer, default, or recommended setup, inspect first and do not
print the questionnaire or a code such as `1A, 2A`. Explain detected and
uncertain product structure in everyday language, omit `not-detected` branches,
and put one concise uncertainty assumption in the receipt. Show one recommended
receipt covering applicable histories, destinations, release-note grouping,
major-release naming, versions, storage, instructions, and history handling.
Ask for exactly one response: confirm or request changes. Confirmation remains
required and does not weaken evidence, dependency, authentication, publication,
or deployment boundaries.

When that compact summary is an automatic Web modal, recommend **Local and
preview only** for a marketing, portfolio, brochure, agency, or client-review
site. For a returning-user product app whose customers should receive automatic
announcements, preserve **All environments** unless repository evidence or the
owner selects another scope.

## Customized questions

Ask applicable questions in this order: product shape, history audiences, exact
current destinations, destination placement/visibility/discovery/links/
components, versions, release-note organization and stable-major naming, audit
comments, storage, instruction pointer, then released history last. Do not ask
downstream questions before their destination exists or show choices for a
`not-detected` surface unless the user plans it.

Ask project type only when selected distribution and repository evidence remain
unresolved or conflicting. Ask **What kind of project is this? Choose one:**

1. **Web product** — Public or customer-facing Web history; select `web`.
2. **Mobile application** — Native app and established store destinations;
   select `mobile`.
3. **Web product with an internal CMS** — Public Web history plus protected
   operator history; select `web-cms`.
4. **Agent skill or skill package** — Skill-user and maintainer history; select
   `skill-repository`.
5. **Multiple product surfaces** — Web, mobile, store, internal, or other
   destinations share this repository; select `full`.
6. **Internal CMS only** — Protected operator history only; select the CMS-only
   policy.

Show only plausible choices and mark the evidence-backed one **Recommended**.
Never silently convert valid policy.

Skip the history-audience question for CMS-only. Otherwise ask **Who needs a
maintained history? Choose one:**

1. **Customers and developers — Recommended** — Maintain `CHANGELOG.md` and
   `DEVELOPER_CHANGELOG.md`; save `required`.
2. **Customers only** — Maintain only `CHANGELOG.md`; save `optional` and keep
   technical context in commits and change-request descriptions.

For a skill repository, label those choices **Skill users and maintainers** and
**Skill users only**.

For Markdown distributions, ask **Should raw changelog edits include hidden
agent-and-time audit comments? Choose one:**

1. **Include hidden comments — Recommended** — Save `agent-and-timestamp`.
   Rendered notes omit them; they are informational, not cryptographic proof.
2. **Do not add comments** — Save `none` and preserve any comments already
   present.

CMS-only has no raw-Markdown signature field.

Do not ask a first-time user for standing authority over hypothetical future
release-note UI. Initial setup saves `newReleaseNoteSurfaces: "ask"`. When a
later task actually needs a missing page, modal, route, screen, or navigation
entry, scan the then-current repository and ask about the exact proposed
surface, audience, placement, dependencies, and environment exposure.

Keep `allow` and `existing-only` supported for an explicit advanced policy
request. Explain that `allow` never grants deployment, publication, store
submission, hosted release, a new audience, or unrelated dependencies. Do not
offer either value during normal first-time onboarding.

## Mobile-history placement

For the full distribution, explain that the canonical Mobile feed remains the
source for every option, but the selected destinations differ. Store-only copy
can be prepared for App Store, Google Play, testing-track, or repository-owned
store metadata without adding an in-app history. The other three choices retain
the Mobile feed for established in-app and store destinations. Shared
cross-platform outcomes still appear in the Web history when Web users benefit
from them.

Ask **Where should people be able to read mobile-specific release notes?
Choose one:**

```text
1. App stores only
   Mobile feed -> App Store / Google Play metadata; no in-app or Web history

2. Mobile app and app stores — no Web
   Mobile feed -> app / stores; Web history excludes mobile-only items

3. Web and mobile — one tabbed page
   Canonical history -> Web tab + Mobile tab -> Mobile feed also serves app / stores

4. Web and mobile — separate Web pages
   Canonical history -> Web history + linked Mobile history -> Mobile feed also serves app / stores
```

1. **App stores only** — Prepare concise per-release storefront copy for
   established App Store, Google Play, testing-track, or repository metadata
   destinations. Do not add an in-app or Web release-history surface. Store
   `store-only`. Store submission and remote metadata writes still require
   separate authority and credentials.
2. **Mobile app and app stores — no Web — Recommended when no new Web UI is
   needed** —
   Keep mobile-specific history in established mobile and store destinations
   and out of Web changelog destinations. Store `mobile-only`.
3. **Web and mobile — one tabbed Release Notes page** — Let Web visitors browse
   independently filtered **Web** and **Mobile** histories under labeled tabs
   at one Web destination. The same Mobile feed remains available to the app
   and stores. Store `web-tabs`.
4. **Web and mobile — separate Release Notes pages** — Keep the normal Web
   history at its established destination and add a linked Web page for the
   independently filtered Mobile history. The same Mobile feed remains
   available to the app and stores. Store `web-page`.

Do not shorten these to bare `store-only`, `mobile-only`, `web-tabs`, or
`web-page` choices. Those are receipt values, not sufficient user-facing
explanations. Choosing a presentation records the desired placement but does
not authorize a missing tab set, page, route, navigation entry, in-app screen,
store submission, deployment, or publication.

## Public-version choice

For public versions, explain patch (`1.5.0` to `1.5.1`), backward-compatible
minor (`1.5.0` to `1.6.0`), and potentially breaking major (`1.5.0` to
`2.0.0`). Ask **How should new public release versions be chosen?** Offer:

1. **Ask for patch, minor, and major — Recommended** — Suggest, then wait.
2. **Automatic patch; ask for minor and major** — Automate routine fixes.
3. **Automatic patch and minor; ask for major** — Pause for breaking releases.
4. **All automatic** — Select every version without approval.
5. **Customize each level** — Set each to `ask` or `automatic`.

Persist only the resolved `patch`, `minor`, `major`, and
`suggestWhenAsking` object. When any level asks, offer exact suggestions
(recommended) or no suggestion; suppress this question when all are automatic.

Recommended setup resolves ask/ask/ask with suggestions on without extra
questions. The receipt says ordinary work stays under `Unreleased`, the choice
changes version selection only, and deployment, publication, store, migration,
secret, environment, and DNS authority remain separate. Global automatic
preferences require repository or current-run confirmation before activation.

For coordinated Simple Changes onboarding, return only these applicable
questions, the resolved summary, owner `simple-changelogs`, and exact policy
destination. Each owner writes its own policy. Preserve a successful owner
write on partial failure and resume from inspection and write receipts.

## Release-note organization and major names

Recommended setup records `releaseNoteGrouping: "product-areas"`. Related
bullets are grouped under short product areas that users recognize, repeated
areas are merged across the release, and important areas come first. Do not
create one-bullet categories merely for symmetry. `flat` keeps release bullets
flat but still allows nested outcomes beneath one named feature. Show this
default in the receipt; ask the grouping choice only on **Customize**, **Change
something**, or an explicit grouping request.

During every public-history onboarding, ask **Should stable major releases have
descriptive names? Choose one:**

1. **Name major releases — Recommended** — Save `majorReleaseNaming: "named"`.
   A reviewed title such as **A New Foundation** sits beside the real `2.0.0`
   identity; the name never replaces the version.
2. **Use version numbers only** — Save `majorReleaseNaming: "version-only"`.
   Major releases keep their version and date without a generated title.

Minor releases require no release name. Patch releases use **Bug Fixes &
Improvements**, keep their bullets flat, and never add category groups beneath
that title. If the proposed contents require a feature or breaking-change
story, correct the release level instead of forcing them into the patch
template. Existing released titles remain unchanged unless a separately
authorized historical correction applies.


## Public release-note layer

Ask this question only when inspection detects a public release-note
destination — an established public archive, marketing or release-notes page,
or release-note modal — or when the user chose **Customize**. Skip it
otherwise; a missing field behaves as `full`.

Define the term first: curated release notes are a short, advertised version
of each release. The complete changelog still records every change; a derived
`RELEASE_NOTES.md` file additionally picks a few one-sentence highlights per
release and sums up the rest in one rollup line.

Ask **What should public release-note surfaces show for each release? Choose
one:**

1. **A short curated summary** — Save `publicReleaseNotes: "curated"`. Each
   release gets 3-8 one-sentence highlights plus one rollup line in a derived
   `RELEASE_NOTES.md`; the complete changelog remains the source of truth, so
   nothing is lost.
2. **The complete history** — Save `publicReleaseNotes: "full"`, the default.
   Public surfaces render the full changelog and no separate curated file is
   maintained.

Mark the curated option **Recommended** when a public marketing or web surface
exists; otherwise mark the complete history **Recommended**. Breaking changes
and security notices are always shown and never summarized away under either
choice. The one-answer recommended path asks no extra question; it includes
the resolved choice in the setup receipt. An optional highlight budget
(`curationBudget`, default 3-8) may be recorded with `--curation-min` and
`--curation-max`. `references/curation.md` owns the derived file's rules;
choosing curated authorizes no new page, route, or destination.

## Contextual product-surface choice

For the `full`, `web`, `mobile`, `web-cms`, and CMS-only distributions,
always offer this choice before the final history question. Skip it only for
skill-repository onboarding. An explicit decline keeps product UI unchanged
and does not block ordinary changelog work.

Start with the inspection result, not a hypothetical menu. Report the detected
repository shape, Web, Mobile, store-metadata, CMS, and workspace evidence,
then list every release-note destination candidate and whether route
reachability, audience, source, and release coverage actually prove it is
established.

When one or more suitable destinations are established, recommend reusing and
synchronizing every eligible existing destination. Do not propose a duplicate
surface merely because a generic default would have used a different route,
label, component library, or content model.

When no suitable destination is established, say **I scanned the repository
and did not find an established release-notes destination. What would you like
to do? Choose one:**

1. **Create the recommended release-notes destination — Recommended** — First
   show the detected product structure and the exact destination, route or
   metadata files, audience, and dependencies the skill recommends. Create it
   only after the final receipt is confirmed.
2. **Let me choose which destinations to add** — Offer only the Web archive,
   mobile in-app history, app-store update notes, authenticated CMS history,
   or other destinations relevant to the user's request, while allowing the
   user to name a planned surface that inspection did not detect.
3. **Use changelog files only for now** — Add no product or store destination;
   future surface work scans again and follows the saved ongoing policy.

Treat the recommended creation as a proposal, not silent implementation. The
default `newReleaseNoteSurfaces: "ask"` means setup proactively offers a useful
surface when none exists while the confirmed receipt supplies authority only
for the exact current destinations. It does not grant open-ended UI creation.

After the user names one or several destination types, refresh the inspection
and compare each request with `surfaceStructureEvidence`. A repository does
not have to be a monorepo to contain several products, but folder names,
dependencies, build configuration, route wiring, and authentication boundaries
must support the requested topology. Never treat the user's choice itself as
evidence that the code already exists.

For every requested product type with no supporting structure, say **I scanned
the repository, but I did not find a [Web app / mobile app / authenticated CMS
/ store-release integration] here. Did you mean to configure this as a planned
surface? Choose one:**

1. **Yes, keep it as a planned surface** — Record the confirmed distribution
   intent and the missing evidence in the receipt. Do not invent an app root,
   CMS route, authentication boundary, store credential, or workspace layout,
   and do not create the underlying product unless the current request
   separately authorizes that work. CMS policy remains pending until an exact
   authenticated route and contained source can be proven.
2. **No, let me choose again** — Return to the destination choices without
   writing setup state.

Repeat this confirmation for each unsupported type rather than collapsing
several mismatches into an ambiguous yes. If repository structure changes
during the task, scan once more before preparing the final receipt.

Inspect each candidate's route wiring, navigation, content model, source,
audience, and release coverage. Classify it as:

- an established full-history release archive only when it is reachable and
  actually presents canonical versioned or dated release history;
- an adjacent editorial destination when it publishes product stories,
  announcements, news, or blog-style updates without serving as the canonical
  release archive; or
- unrelated when neither use applies.

Do not treat a route called Updates or Release Notes as an established archive
from its name alone. When a suitable archive already exists, propose
synchronizing and seeding that archive instead of creating a duplicate. When
no suitable archive exists, ask **Should I build a Release Notes page? This is
the complete history of shipped updates. Choose where it should go. Don't
worry: building it does not automatically show it to live visitors. If you
choose a page or section, the very next question asks who should see it.**

1. **Add Release Notes to an existing page** — Name the route. Use this when
  that page can keep its current content and chronological release history
  clearly separated. Its visibility is chosen next.
2. **Create a dedicated Release Notes page — Recommended for editorial sites**
  — Normally use `/release-notes` when an existing blog, newsroom,
  announcement feed, or marketing page would become cluttered. Its visibility
  is chosen next.
3. **Do not add a Web archive now** — keep the candidate unchanged and limit
  the task to canonical changelog work.

For every approved Web archive, immediately ask **Who should see Release
Notes? Choose one:** Explain that this controls where the archive is shown, not
account permissions or who is allowed to edit it.

```text
                         Local       Preview       Production
1. All environments    AVAILABLE     AVAILABLE       AVAILABLE
2. Local + preview     AVAILABLE     AVAILABLE         HIDDEN
3. Production only      HIDDEN        HIDDEN         AVAILABLE
4. Disabled             HIDDEN        HIDDEN           HIDDEN
```

1. **Developers, preview reviewers, and live visitors** — Show Release Notes in
   all environments. Any
   selected navigation, manual summary, or automatic modal may also appear.
   Save `all-environments`.
2. **Developers and preview reviewers only — Recommended for marketing and
   client sites** — Show the page and any selected entry points or modal during
   local development and review previews. Live visitors do not see the route,
   navigation, links, summaries, or modal. Save `non-production`.
3. **Live visitors only** — Hide the page and every entry point during local
   development and review previews; show the selected Release Notes surfaces
   only on the live production site. Save `production-only`.
4. **No one yet** — Do not show or link the Release Notes page anywhere. Save
   `disabled`; canonical changelog generation and archive-data synchronization
   can still continue.

Use the repository's authoritative environment signal. Local development is
non-production. Do not guess from hostnames or branch names. Enforce the choice
at the route, server, or build boundary and at every navigation, manual-link,
summary, and modal entry point. A hidden dynamic route returns the framework's
standard not-found response; a static production build omits the route when the
framework supports that. For a scoped choice, an unknown environment fails
closed and exposes none of the surfaces. This preference controls Web exposure,
not changelog generation, archive-data synchronization, deployment, or
publication.
Record the selected value as repository policy
`releaseNoteEnvironmentScope`.

Only after visibility is understood, and only when the selected environments
serve returning users, ask **How should people discover the latest release?
Choose one:**

1. **Automatic Release Notes modal — Recommended for product apps** — show only
  the latest qualifying highlights to eligible returning users in the selected
  environments and link to the full archive.
2. **Manual Release Notes summary** — keep a compact summary reachable without
  automatic display in the selected environments.
3. **Archive only — Recommended for marketing and client-review sites** — add
  no compact surface.

When any product release-note destination is selected, ask **Should individual
release items link directly to the feature they describe? Choose one:**

```text
Release item ── Open feature ──▶ Eligible app route or screen
```

1. **Link when useful — Recommended** — Add an action only when it materially
   helps the eligible reader use, configure, or inspect the released feature.
   Save `when-useful`.
2. **Ask before linking** — Show the exact action label and destination, then
   wait for owner approval before wiring it. Save `ask`.
3. **No feature links** — Keep individual items informational. Save `disabled`.

Explain that a new route is only a candidate: its release, stability, audience,
authentication, role, tenant, platform, flag, and environment eligibility must
all be verified. Structural navigation from a summary to the Release Notes
archive remains available. Record the answer as repository policy
`releaseNoteLinks`; never store it in all-projects preferences.

The confirmed receipt must name the exact candidate classification, archive
choice, environment scope, feature-link policy, compact-surface choice, route
or placement, and visible labels. That
confirmation authorizes only those named surfaces for the current task; it does
not silently change the ongoing `newReleaseNoteSurfaces` policy.

Use **Release Notes** by default for customer-facing archives and compact
summaries. Use **Changelog** by default for developer, administrator, operator,
or maintainer-facing technical history. Treat “What's New” as a compact-summary
pattern, not the default visible label. Preserve an established or explicitly
requested product naming preference instead of renaming it automatically.

## Component-source choice

When the user selects a surface and inspection finds an established component
library or repository-owned design system, use it and record
`project-components`; do not ask a redundant styling question. State the
evidence and let the user correct a false positive.

When no established system is found, ask **Which component source should the
release-notes surface use? Choose one:**

1. **Use the recommendation — Recommended** — for React web projects, recommend shadcn/ui on
  Base UI; when Radix primitives already exist, recommend shadcn/ui on Radix
  without migrating the primitive layer; for mobile, recommend the app's
  platform-native components.
2. **Use another component library** — record the library named by the user and
  map the policy to the applicable project or platform component source.
3. **Use minimal markup** — add no component dependency and follow the
  repository's existing CSS or native styling approach.

Name every package the recommended option would add. A dependency is a product
change, so the later receipt must include it. Follow the component library's
current documentation instead of embedding version-sensitive imports or props
in the guidance.

## Preference scope

Ask **Where should these reusable setup preferences apply? Choose one:**

```text
1. This repository   -> .simple-changelogs.json
2. All my projects   -> private preferences.json + repository policy
3. This run only     -> no preference file
```

1. **This repository — Recommended for teams** — Commit visible project policy
   beside the changelogs.
2. **All my projects** — Also save only the portable solo-developer defaults
   listed below in a private global preferences file.
3. **This run only** — Write no durable policy or preferences; ask again next
   time.

Repository scope writes visible policy beside the histories. All-projects scope
also writes a private `preferences.json` containing only:

- `developerChangelog`
- `releaseNoteGrouping`
- `majorReleaseNaming`
- `signatures`
- `newReleaseNoteSurfaces`
- `setupStyle`

It stores no distribution, audience, route, authentication boundary, changelog
path, released-history state, release metadata, repository identifier, or
publication authority. Repository evidence and policy always outrank these
defaults.

The global path is:

- macOS: `~/Library/Application Support/simple-changelogs/preferences.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/simple-changelogs/preferences.json`
- Windows: `%APPDATA%/simple-changelogs/preferences.json`

`SIMPLE_CHANGELOGS_CONFIG_DIR` overrides the containing directory for
deterministic automation.

## Repository-instruction pointer

The distribution checkpoint counts repository instructions among the signals
that select a distribution, but nothing in onboarding ever writes that signal.
It has to be added by hand, so a repository that wants the changelog step to be
reached reliably tends to grow a hand-written block that drifts into restating
this skill.

Ask this after preference scope, and target the scope already chosen:

- Repository scope offers the repository's own agent-instruction file —
  `AGENTS.md`, `CLAUDE.md`, or a comparable always-loaded file.
- All-projects scope offers the user's global agent-instruction file, the same
  audience as the global preferences above. A solo developer who keeps one
  instruction file across their projects should be asked once, not once per
  repository.
- Run-only scope writes nothing.

Ask **Should setup add the short changelog pointer to `[exact file]`? Choose
one:**

1. **Add the pointer — Recommended when this file is always loaded** — Add or
   update one concise pointer after confirmation.
2. **Leave instructions unchanged** — Make no change to the instruction file.

Name the exact file in the question and receipt. When the chosen scope has no
such file, say so and move on rather than creating one.

Never write to an agent-instruction file without explicit confirmation. That
file governs agent behavior generally, so it is the user's to change even when
the edit is small. Treat the global file as the higher-consequence choice: it
applies to every repository on that machine, including repositories this skill
does not serve.

A global pointer must therefore stay distribution-neutral. It states that a
repository's own changelog skill owns the decision, and names no distribution,
path, route, or repository — the same constraint the global preferences carry.
Naming one distribution there would be wrong in any repository that uses a
different one or a local fork.

Write a pointer, never a copy. Include only when the changelog decision is due,
the requirement to state the outcome even when no entry is needed, and which
skill owns the decision. Classification, exclusions, and wording belong in this
skill; duplicating them creates a second copy that drifts independently and is
read more often than the original. Detect an existing pointer and update it in
place rather than appending a second one.

## Final history question

After every other unresolved onboarding choice, ask about released history
last, immediately before the confirmation receipt. Ask **How should setup
handle the released history already in this repository? Choose one:**

1. **Review the complete history now — Recommended** — Start the comprehensive
   initial backfill as `partial`, then record `completed` only after verification.
2. **Maybe later** — Save `deferred` and continue prospective changelog work.
3. **Leave existing history alone** — Save `declined` and apply new guidance
   only to future work.

Do not require a separate “Review it now” approval. With no released history,
use `not-applicable` without asking. Silence records nothing; confirmation of
the receipt accepts the displayed default.

## Confirm, apply, and continue

Prepare full details, but first show a compact **Here's what will happen**
confirmation covering files, exact new surfaces, who sees them, version
automation, dependencies, history handling, and excluded authority. End with
**Confirm**, **Show details**, or **Change something**. Details include every
resolved policy, package, path, label, environment, and authority boundary. A
compact confirmation authorizes only named outcomes; hidden detail can never
expand its scope. Show details first if compact authority would be ambiguous.

Then pass explicit choices to the helper:

```sh
bun skills/simple-changelogs/scripts/setup.ts apply \
  --developer-history required \
  --release-note-grouping product-areas \
  --major-release-naming named \
  --signatures agent-and-timestamp \
  --new-surfaces ask \
  --version-patch ask \
  --version-minor ask \
  --version-major ask \
  --version-suggestions on \
  --surface-components recommended-web-components \
  --release-note-environments non-production \
  --release-note-links when-useful \
  --backfill deferred \
  --scope repository \
  --setup-style recommended \
  --confirm \
  --repo .
```

Use `--scope all-projects` for the solo profile or `--scope run-only` for no
durable state. The JSON result reports selected values and every write. Re-read
and validate stored state after application.

After explicit user confirmation of a receipt that names release-note surfaces,
implement only those approved surfaces using `references/surface-design.md`.
Seed each archive from the complete canonical history available in
`CHANGELOG.md`, and keep the compact summary at the latest qualifying release.
If the separate released-history audit was deferred or declined, seed only the
history that exists and report the limitation. A surface receipt never
authorizes reconstructing or rewriting released history. Honor an explicit
narrower-seed choice, then resume the original changelog request.

## CMS branches

CMS onboarding remains repository-specific even when global defaults exist.
Verify authentication and the operator role from code and tests, reuse a proven
protected route, and choose one repository-root JSON filename. Pass
`--cms-auth-proven`, `--cms-surface-proven`, `--cms-route /exact/route`, and
optionally `--cms-changelog CMS_CHANGELOG.json`. Global defaults never supply a
CMS route, access boundary, or source path.

Web+CMS setup stages standard and CMS policy together. If authentication,
protected-route evidence, path containment, or validation fails, neither policy
is accepted as complete. A resumed helper run verifies any transaction-owned
file before completing the missing writes.
