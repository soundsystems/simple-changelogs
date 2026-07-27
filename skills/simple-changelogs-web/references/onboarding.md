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
Updates, News, Blog, or Announcements candidates, developer-history and CMS
evidence, component-library evidence, global defaults, a recommendation, and
unresolved questions. A path name or dependency is discovery evidence, not
proof that a route is reachable, contains release history, or uses that
component stack for product UI. Do not ask for a choice already established by
current instructions, repository policy, or trustworthy evidence.

## First screen

Summarize concrete findings in one short paragraph, then offer:

- **Use recommended setup** — Apply evidence-backed safe defaults. When
  released history exists, include the full backfill and ask last only whether
  the user wants to defer or decline it.
- **Customize** — Ask only the unresolved questions below.
- **Use preferences for this run only** — Apply the choices to the current task
  without writing policy; onboarding appears again next time.

The recommended path uses a developer history, hidden agent-and-time audit
comments, `ask` for future missing destinations, and an archive plus compact
release summary for product distributions. With no released history, record
`not-applicable`. With released history, include a comprehensive initial
backfill by default and offer deferral or refusal as the final onboarding
choice. Record nothing until the user confirms the setup receipt.

## Customized questions

Ask project type only when selected distribution and repository evidence remain
unresolved or conflicting. Map Web product to `web`, Mobile application to
`mobile`, Web product with an internal CMS to `web-cms`, Agent skill or skill
package to `skill-repository`, Multiple product surfaces to `full`, and
Internal CMS only to the CMS-only policy. Never silently convert valid policy.

Skip the history-audience question for CMS-only. Otherwise offer customer and
developer histories (`required`) or customer history only (`optional`). For a
skill repository, label the audiences as skill users and maintainers or skill
users only. In a customer-only workflow, preserve technical context in commits
and change-request descriptions.

For Markdown distributions, ask whether raw edits receive hidden audit
comments. `Yes` maps to `agent-and-timestamp`; `No` maps to `none`. Explain that
rendered notes omit the comments and that they are informational, not
cryptographic proof. CMS-only has no raw-Markdown signature field.

Ask what to do when a release needs a new release-note destination:

- **Ask me first** maps to `ask` and is recommended.
- **You may add it** maps to `allow`.
- **Use existing destinations only** maps to `existing-only`.

`allow` covers only scoped product implementation for a missing release-note
destination. It never grants deployment, publication, store submission, hosted
release, new-audience, or internal-information authority.

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
no suitable archive exists, ask where the release archive should live:

- **Add a Release Notes tab or section there** — use when the existing
  destination can keep editorial posts and chronological release history
  clearly separated.
- **Create a dedicated Release Notes page** — recommended when the existing
  destination is primarily a blog, newsroom, announcement feed, or marketing
  channel.
- **Do not add a public archive now** — keep the candidate unchanged and limit
  the task to canonical changelog work.

If the product has returning users and the user selects a public archive, offer
the compact surface separately:

- **Automatic Release Notes modal** — recommended; show only the latest
  qualifying highlights to eligible returning users and link to the selected
  full archive.
- **Manual Release Notes summary** — keep a compact summary reachable without
  automatic display.
- **Archive only** — add no compact surface.

The confirmed receipt must name the exact candidate classification, archive
choice, compact-surface choice, route or placement, and visible labels. That
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

When no established system is found, ask one question:

- **Use the recommendation** — for React web projects, recommend shadcn/ui on
  Base UI; when Radix primitives already exist, recommend shadcn/ui on Radix
  without migrating the primitive layer; for mobile, recommend the app's
  platform-native components.
- **Use another component library** — record the library named by the user and
  map the policy to the applicable project or platform component source.
- **Use minimal markup** — add no component dependency and follow the
  repository's existing CSS or native styling approach.

Name every package the recommended option would add. A dependency is a product
change, so the later receipt must include it. Follow the component library's
current documentation instead of embedding version-sensitive imports or props
in the guidance.

## Preference scope

Offer repository, all-projects solo-developer, or run-only scope.

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

Offer **Add the pointer** or **Leave instructions unchanged**, and name the
exact file in the receipt. When the chosen scope has no such file, say so and
move on rather than creating one.

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
read more often than the original. Detect an existing pointer and update
it in place rather than appending a second one.

## Final history question

After every other unresolved onboarding choice, ask about released history
last, immediately before the confirmation receipt. State that the recommended
setup includes a comprehensive initial backfill (`partial` until verified, then
`completed`) and ask only whether to change that default to Maybe later
(`deferred`) or Leave existing history alone (`declined`). Do not require a
separate “Review it now” approval. With no released history, use
`not-applicable` without asking. Silence records nothing; confirmation of the
receipt accepts the displayed default.

## Confirm, apply, and continue

Before durable writes, show a receipt naming the selected distribution,
audiences, signatures, missing-destination behavior, any contextual product
surface choices, component source, every dependency to add, archive-seeding
disposition, history disposition, and every policy or preference path. State
that setup grants no deployment, publication, store-submission, CMS-access, or
unrelated released-history authority. Require confirmation.

Then pass explicit choices to the helper:

```sh
bun skills/simple-changelogs-web/scripts/setup.ts apply \
  --developer-history required \
  --signatures agent-and-timestamp \
  --new-surfaces ask \
  --surface-components recommended-web-components \
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
