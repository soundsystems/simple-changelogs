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
archive, compact summary, or component source. Skip the surface and
component questions, leave `newReleaseNoteSurfaceComponents` unrecorded, and
resume the original changelog request after the stored state revalidates.

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
