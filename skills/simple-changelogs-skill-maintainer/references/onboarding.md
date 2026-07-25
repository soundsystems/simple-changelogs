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
evidence, history counts, established destinations, developer-history and CMS
evidence, global defaults, a recommendation, and unresolved questions. Do not
ask for a choice already established by current instructions, repository
policy, or trustworthy evidence.

## First screen

Summarize concrete findings in one short paragraph, then offer:

- **Use recommended setup** — Apply evidence-backed safe defaults. Ask only
  about released-history review when released history exists.
- **Customize** — Ask only the unresolved questions below.
- **Use preferences for this run only** — Apply the choices to the current task
  without writing policy; onboarding appears again next time.

The recommended path uses a developer history, hidden agent-and-time audit
comments, and `ask` for a missing release-note destination. With no released
history, record `not-applicable`. With released history, never infer an answer.

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

When released history exists, offer Review it now (`partial` until verified,
then `completed`), Maybe later (`deferred`), or Leave existing history alone
(`declined`). With no released history, use `not-applicable` without asking.
Silence records nothing.

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

## Confirm, apply, and continue

Before durable writes, show a receipt naming the selected distribution,
audiences, signatures, missing-destination behavior, history disposition, and
every policy or preference path. State that setup grants no deployment,
publication, store-submission, CMS-access, or unrelated released-history
authority. Require confirmation.

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
and validate stored state after application, then resume the original changelog
request.

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
