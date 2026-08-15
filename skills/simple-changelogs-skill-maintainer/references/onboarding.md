# Conversational Onboarding

Use this flow only when a write-capable changelog request reaches a repository
without valid policy for the selected distribution. Setup is a checkpoint
inside the original task, not a separate task.

## Inspect before asking

Classify the current request and run the selected distribution's bundled
helper. For a repository-local web distribution:

```sh
bun skills/simple-changelogs-web/scripts/setup.ts inspect \
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
component-library evidence, global defaults, a recommendation, and unresolved
questions. A path name or dependency is discovery evidence, not
proof that a route is reachable, contains release history, or uses that
component stack for product UI. Do not ask for a choice already established by
current instructions, repository policy, or trustworthy evidence.

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

Use a compact text diagram when a choice changes audience, environment, data
flow, or write scope. Keep the diagram beside the options it explains and
label both the shown and suppressed path. Skip diagrams for choices whose
effect is already obvious from one sentence.

## Explain before asking

Do not make the owner reverse-engineer the workflow from setup fields. Before
the first choice, explain in plain language:

- Simple Changelogs keeps durable audience-facing outcomes separate from
  technical maintainer history when the selected distribution owns both;
- it can start or adopt changelogs, classify current work, prepare and verify a
  release, synchronize established destinations, review older history when
  authorized, and explain what changed after a skill update;
- one canonical item may feed several independently filtered destinations
  without making their audiences interchangeable;
- setup records preferences and evidence but does not itself publish, deploy,
  submit a store release, create a hosted release, expose protected content, or
  rewrite history; and
- the current request continues after setup, so the user never has to repeat it.

Then summarize the concrete evidence: selected distribution and why, existing
histories, released-history count, proven and candidate destinations, version
owners when applicable, component-system evidence, and the exact files setup
could write. State which choices the current request or repository already
decided, show the recommended defaults, and say that nothing has been written,
backfilled, published, deployed, submitted, or exposed yet.

## First screen

Summarize concrete findings and the recommended path, then ask **How would you
like to set up Simple Changelogs? Choose one:**

1. **Use recommended setup — Recommended** — Apply evidence-backed safe defaults. When
  released history exists, include the full backfill and ask last only whether
  the user wants to defer or decline it.
2. **Walk me through it** — Explain every main workflow, every relevant
  destination, and each preference in plain language, one at a time, before
  saving anything.
3. **Customize** — Explain and ask only the unresolved questions below.
4. **Use recommended setup for this run only** — Apply the choices to the current task
  without writing policy; onboarding appears again next time.

The walkthrough first shows how ordinary edits, release preparation,
destination synchronization, historical review, version decisions where
applicable, delegated Simple Changes handoffs, and later skill updates flow
from inspection through verification. For each topic, explain what the skill
does automatically, what still requires a decision, and what authority the
choice does not grant. Then ask the same unresolved owner choices below one at
a time. The walkthrough is a conversation path, not a new stored policy value;
a confirmed walkthrough uses the customized setup style in the receipt.

The recommended path uses a developer history, hidden agent-and-time audit
comments, `ask` for future missing destinations, and an archive plus compact
release summary for product distributions. With no released history, record
`not-applicable`. With released history, include a comprehensive initial
backfill by default and offer deferral or refusal as the final onboarding
choice. Record nothing until the user confirms the setup receipt.

When that compact summary is an automatic Web modal, recommend **Local and
preview only** for a marketing, portfolio, brochure, agency, or client-review
site. For a returning-user product app whose customers should receive automatic
announcements, preserve **All environments** unless repository evidence or the
owner selects another scope.

## Customized questions

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

Ask **When a release needs a release-notes page or modal that this project does
not have yet, what should happen? Choose one:**

1. **Ask me first — Recommended** — Pause before adding product UI. Save `ask`.
2. **You may add it** — The skill may add a release-note destination when the
   active release needs one. Save `allow`; deployment and publication still
   require separate authority.
3. **Use existing destinations only** — Update proven destinations but never
   add another without a new explicit request. Save `existing-only`.

`allow` covers only scoped product implementation for a missing release-note
destination. It never grants deployment, publication, store submission, hosted
release, new-audience, or internal-information authority.

## Public-version choice

Ask how patch, minor, and major public package versions should be chosen. Offer
safe ask/ask/ask with exact suggestions (recommended), automatic patch and
minor, all automatic, or granular customization. Persist the resolved object
only. Suppress the suggestion question when every level is automatic. Global
values prefill but require repository or current-run confirmation. The receipt
states that work remains under `Unreleased` until a public boundary and that
version selection grants no publication, tagging, or hosted-release authority.
Coordinated setup keeps separate owners and resumable write receipts.

## Contextual product-surface choice

For the `full`, `web`, `mobile`, `web-cms`, and CMS-only distributions,
always offer this choice before the final history question. Skip it only for
skill-repository onboarding. An explicit decline keeps product UI unchanged
and does not block ordinary changelog work.

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
no suitable archive exists, ask **Where should the complete release history
live? Choose one:**

1. **Add a Release Notes tab or section there** — use when the existing
  destination can keep editorial posts and chronological release history
  clearly separated.
2. **Create a dedicated Release Notes page — Recommended for editorial
   sites** — use when the existing
  destination is primarily a blog, newsroom, announcement feed, or marketing
  channel.
3. **Do not add a public archive now** — keep the candidate unchanged and limit
  the task to canonical changelog work.

If the product has returning users and the user selects a public archive, ask
**How should people discover the latest release? Choose one:**

1. **Automatic Release Notes modal — Recommended for product apps** — show only the latest
  qualifying highlights to eligible returning users and link to the selected
  full archive.
2. **Manual Release Notes summary** — keep a compact summary reachable without
  automatic display.
3. **Archive only** — add no compact surface.

For every approved public Web archive, immediately ask **In which environments
should Release Notes be available? Choose one:**

```text
                         Local       Preview       Production
1. All environments    AVAILABLE     AVAILABLE       AVAILABLE
2. Local + preview     AVAILABLE     AVAILABLE         HIDDEN
3. Production only      HIDDEN        HIDDEN         AVAILABLE
4. Disabled             HIDDEN        HIDDEN           HIDDEN
```

1. **All environments — Current behavior** — Local developers, preview
   reviewers, and production visitors can open the Release Notes page; any
   selected navigation, manual summary, or automatic modal may also appear.
   Save `all-environments`.
2. **Local and preview only — Recommended for marketing and client sites** —
   Keep the page and any selected entry points or modal available throughout
   local development and recognized previews. In production, do not serve the
   route or expose navigation, manual links, summaries, or the modal. Save
   `non-production`.
3. **Production deployments only** — Hide the page and every entry point in
   local development and previews; expose the selected Release Notes surfaces
   only in production. Save `production-only`.
4. **Disabled everywhere** — Do not serve or link the Release Notes page and do
   not render a summary or modal in any environment. Save `disabled`; canonical
   changelog generation and archive-data synchronization can still continue.

Use the repository's authoritative environment signal. Local development is
non-production. Do not guess from hostnames or branch names. Enforce the choice
at the route, server, or build boundary and at every navigation, manual-link,
summary, and modal entry point. A hidden dynamic route returns the framework's
standard not-found response; a static production build omits the route when the
framework supports that. For a scoped choice, an unknown environment fails
closed and exposes none of the surfaces. This preference controls Web exposure,
not changelog generation, archive-data synchronization, deployment, or
publication.

The confirmed receipt must name the exact candidate classification, archive
choice, environment scope, compact-surface choice, route or placement, and
visible labels. That
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

Before durable writes, show a receipt naming the selected distribution,
audiences, signatures, missing-destination behavior, any contextual product
surface choices, release-note environment scope, component source, every dependency to
add, archive-seeding
disposition, history disposition, and every policy or preference path. State
that setup grants no deployment, publication, store-submission, CMS-access, or
unrelated released-history authority. Require confirmation.

Then pass explicit choices to the helper:

```sh
bun skills/simple-changelogs-skill-maintainer/scripts/setup.ts apply \
  --developer-history required \
  --signatures agent-and-timestamp \
  --new-surfaces ask \
  --version-patch ask \
  --version-minor ask \
  --version-major ask \
  --version-suggestions on \
  --backfill deferred \
  --scope repository \
  --setup-style recommended \
  --confirm \
  --repo .
```

Use `--scope all-projects` for the solo profile or `--scope run-only` for no
durable state. The JSON result reports selected values and every write. Re-read
and validate stored state after application.

A skill repository ships no product application, so onboarding here records no
archive, compact summary, release-note environment scope, or component source. Skip the
surface and component questions, leave
`newReleaseNoteSurfaceComponents` and `releaseNoteEnvironmentScope`
unrecorded, and resume the original changelog request after the stored state
revalidates.

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
