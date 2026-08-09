# Simple Changelogs Evaluation Guide

The repository-only Bun harness separates credential-free package contracts from
adapter-driven behavior checks. Structured expectations live in
`evals/cases.json`; this guide explains how to run and extend them without
restating every case. The harness, adapters, fixtures, schemas, and tests are
not installed with any public distribution.

## Suites

### Contract

The contract suite validates package structure and deterministic rules:

- frontmatter and skill-directory naming;
- required runtime references, scripts, and routed links;
- repository-policy examples and guidance-version coverage;
- canonical instruction ownership and long prose duplication;
- absence of installed-package state mutation, implicit product-UI authority,
  and core vendor coupling;
- package shape, manifest validity, and runtime shell syntax.

It needs Bun, Git, and a POSIX shell for the fork helper syntax check. It does
not invoke a model or require model credentials.

### Trigger and Behavior

The trigger suite checks discover-mode activation evidence. The behavior suite
checks explicit skill use, isolated repository changes, response reports, and
multi-turn state. `all` runs the deterministic contract and selected behavior
cases together.

Each case receives a fresh temporary Git workspace copied from its repository
fixture base. Successful workspaces are removed; failed workspaces are retained
only with `--keep-failures`.

## Commands

Run from the source repository root:

```bash
bun tooling/simple-changelogs/scripts/eval.ts contract
bun tooling/simple-changelogs/scripts/eval.ts trigger --adapter /path/to/adapter
bun tooling/simple-changelogs/scripts/eval.ts behavior --adapter /path/to/adapter
bun tooling/simple-changelogs/scripts/eval.ts all --adapter /path/to/adapter
```

Useful options:

```text
--case <id>              select a case; repeat for multiple IDs
--format text|json       choose human or CI output
--keep-failures          retain failed case workspaces
--timeout-ms <integer>   set the per-adapter timeout
--skill-directory <dir>  evaluate another complete skill package
```

The default timeout is 30000 milliseconds. Text is the default format.

## Exit Status and Interpretation

- `0`: every selected contract and case passed.
- `1`: a deterministic finding exists or at least one selected case did not
  pass. Preserve the case's specific `failed`, `unsupported`, `skipped`, or
  adapter-returned `error` status when interpreting the report.
- `2`: the harness, manifest, adapter, authentication, or configuration was
  invalid.

Adapter absence and authentication failure are configuration errors, not skill
behavior failures. Contract checks remain available without an adapter.

For behavior reports, inspect case status, turn diagnostics, assertion counts,
and retained workspace paths. `unsupported` means a runtime capability such as
native activation tracing or multi-step continuity was unavailable; do not
convert that absence into a guessed pass or failure.

JSON reports use `reportVersion: 1`. Treat status and findings as the public CI
contract rather than parsing text output.

## Adapter Protocol

An adapter executable reads exactly one JSON request from stdin and writes
exactly one JSON response to stdout. Diagnostic and vendor logs go to stderr.
The core launches adapters with an argument array, never through shell command
interpolation.

`RunnerRequest` protocol version 1 includes:

- the full case, current turn index, and prompt;
- skill and isolated workspace directories;
- activation mode `discover` or `explicit`;
- timeout and response-schema path;
- prior user/assistant transcript when the case has multiple turns.

`RunnerResponse` protocol version 1 includes status, ordinary final prose,
optional runtime identity, diagnostics, and a separate evaluation-only report.
That report carries decision and reason codes, authorization records, version
map records, verification results, and optional native activation evidence.
The canonical code vocabulary is documented in the response schema's field
descriptions, which adapters surface to the model with the schema itself; a
coverage test keeps that registry aligned with every code the manifest asserts.

The harness validates the response after extraction. Reported decisions are
assertable metadata, but claimed mutations never replace inspection of the
workspace.

An external adapter may use any runtime if it preserves this protocol, limits
work to the supplied workspace, keeps skill-package files read-only, and
normalizes missing executable, authentication, and configuration failures.
See `evals/schemas/runner-request.schema.json` and
`evals/schemas/runner-response.schema.json` for the exact wire format.

## Canonical Manifest

`evals/cases.json` has `manifestVersion: 1` and a `cases` array. Every case
contains:

- unique `id`;
- suite `trigger` or `behavior`;
- fixture ID and coverage tags;
- activation mode `discover` or `explicit`;
- one or more ordered turns.

Each turn contains a prompt and at least one assertion. Current assertion kinds
are:

- `activation`;
- `path.exists` and `path.absent`;
- `file.changed` and `file.unchanged`;
- `text.match` and `text.notMatch`;
- `json.path`;
- `repo.state` and `git.changedPaths`;
- `report.status`, `report.decision`, `report.authorization`,
  `report.versionMap`, and `report.verification`.

Runner requests and responses use protocol version 2. Every version-map record
carries a required `identifierRole` of `canonical-release`, `public-version`,
`build-number`, or `development-version`, plus an optional `field` for a named
field inside the path and an optional `releaseTrain`. At most one record per
release train may claim `canonical-release`. `report.versionMap` expectations
may assert `path`, `version`, `role`, `identifierRole`, `field`, and
`releaseTrain` independently; unasserted properties are ignored.

Manifest assertions never execute caller-supplied commands. Git inspection and
other subprocess checks use evaluator-owned argument arrays only.

Paths are workspace-relative. Text expectations are regular expressions.
`json.path` combines a relative file and JSON pointer with `#`. Command
assertions use explicit argument arrays and never a shell string.

The manifest schemas reject unknown fixed fields. Use `skip` only for a
documented temporary limitation; canonical coverage tests normally require
cases to remain runnable.

## Adding or Changing a Case

1. Choose the smallest reusable fixture base. Add only data the scenario needs.
   Store any skill file a fixture simulates as `SKILL.fixture.md`; the harness
   renames it to `SKILL.md` inside the temporary workspace, and a contract
   check rejects nested `SKILL.md` files so installed packages never expose
   fixture skills to recursive skill loaders.
2. Add the case to `evals/cases.json` with a unique ID, correct suite, focused
   tags, and explicit activation mode.
3. Express observable outcomes through existing assertions. Prefer filesystem
   evidence over report claims for mutations.
4. Use ordered turns when an authorization answer or follow-up must reuse the
   same workspace and transcript.
5. Add a new assertion kind only with focused tests in
   `scripts/tests/fixtures.check.ts` and aligned manifest validation.
6. From the source repository root, run its explicit non-auto-discoverable test
   command plus the remaining checks:

   ```bash
   bun run test
   bun run eval
   bun run typecheck
   bun run lint
   ```

New normative skill behavior is protected only after a structured case or a
deterministic contract assertion covers it. Keep prose examples here minimal so
the manifest remains the canonical behavior catalog.

## Credentials and Smoke Tests

Model-backed suites consume the adapter runtime's existing local
authentication. The harness never embeds credentials. Run authenticated smoke
tests only when that external capacity is intentionally available; report a
missing login as configuration status `2`.

For a new adapter, first unit-test exact argument arrays, stdin/stdout framing,
final-message extraction, stderr preservation, timeout behavior, and normalized
errors. Then run one trigger and one behavior case before expanding coverage.

The Hermes adapter uses `hermes chat --safe-mode --quiet`, validates its
plain one-shot output against the neutral response schema, and requires the
Docker terminal backend. It overrides Hermes' terminal environment so tool
commands run in a disposable, network-disabled container with the fixture
mounted into its working directory and a nested read-only mount over the skill
snapshot. Local and SSH backends are rejected because they do not provide the
required host-filesystem boundary.

The Grok Build adapter uses `grok --output-format json`, extracts the
final `text` field, and validates that text against the neutral response
schema. It creates an isolated Grok home inside the fixture, disables inherited
host compatibility sources there, and removes the runtime state after the run.
Grok's workspace sandbox keeps the external skill directory outside the
writable boundary. The adapter also disables memory, subagents, web search, and
automatic updates.

The Cursor adapter uses `cursor-agent --print --output-format text`, creates a
read-only skill snapshot inside the temporary fixture, and validates the
printed JSON against the neutral response schema. Cursor Agent does not expose
the same per-invocation OS filesystem policy used by the Codex and Claude
adapters, so use this adapter only with the repository's disposable,
secret-free fixtures. Command auto-approval remains off unless the maintainer
explicitly sets `SIMPLE_CHANGELOGS_CURSOR_FORCE=true`.

Before an authenticated smoke test, verify the current CLI and container
runtime, update Hermes if `chat --safe-mode` is unavailable, and use its normal
setup flow:

```bash
hermes version
hermes update --check
docker version
hermes status
hermes setup --portal
```

Then run a focused case before the full suite:

```bash
bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/hermes.ts \
  --case behavior-customer-visible-feature
```

Use `SIMPLE_CHANGELOGS_HERMES_PROVIDER` and
`SIMPLE_CHANGELOGS_HERMES_MODEL` for per-run provider or model selection. The
adapter never stores provider credentials.

For a Cursor smoke test, verify its existing authentication:

```bash
cursor-agent status
```

Then run a focused disposable fixture:

```bash
bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/cursor.ts \
  --case behavior-customer-visible-feature
```

Use `SIMPLE_CHANGELOGS_CURSOR_MODEL` to select an available model. Set
`SIMPLE_CHANGELOGS_CURSOR_FORCE=true` only when the maintainer explicitly
accepts automatic command approval inside the disposable fixture.

For a Grok Build smoke test, verify the CLI and authenticate with its normal
login flow:

```bash
grok version
grok login
```

Then run the same focused case through the Grok adapter:

```bash
bun tooling/simple-changelogs/scripts/eval.ts behavior \
  --adapter tooling/simple-changelogs/scripts/adapters/grok.ts \
  --case behavior-customer-visible-feature
```

Use `SIMPLE_CHANGELOGS_GROK_MODEL` for a per-run model selection. Grok Build
may also use an existing `XAI_API_KEY`; the adapter never copies credentials
into the fixture.
