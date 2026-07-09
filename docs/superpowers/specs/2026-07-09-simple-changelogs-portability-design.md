# Simple Changelogs Portability and Evaluation Design

## Objective

Make `simple-changelogs` safe to install as a public, harness-agnostic skill
while preserving its intentional customer/developer changelog workflow. Replace
global self-modification with repo-local state, require explicit authorization
before creating product release-note UI, retain useful agent attribution, clarify
pre-1.0 behavior, remove duplicated instructions, bundle operational helpers,
and turn the prose evaluation catalog into a runnable hybrid test suite.

## Design Principles

- Keep the skill contract independent of Codex, Claude Code, Cursor, or any
  other agent harness.
- Keep deterministic behavior in bundled scripts and contextual judgment in
  focused reference files.
- Treat repository-local policy as authoritative for repository-local behavior.
- Never mutate a globally installed skill to remember repository state.
- Let an explicit current user instruction satisfy the approval it names.
- Keep public-history changes conservative without turning backfill into a
  multi-prompt ceremony.
- Preserve the developer changelog as a required part of initial setup.
- Preserve agent signatures as transparent, non-cryptographic audit metadata.
- Make fast contract checks credential-free and behavior checks portable across
  agent runtimes.

## Package Layout

The installed `skills/simple-changelogs/` directory is the complete operational
package:

```text
skills/simple-changelogs/
├── SKILL.md
├── EVAL.md
├── evals/
│   ├── cases.json
│   ├── fixtures/
│   └── schemas/
├── references/
│   ├── automation-verification.md
│   ├── backfill.md
│   ├── entry-classification.md
│   ├── fork-maintenance.md
│   ├── guidance-updates.md
│   ├── release-lifecycle.md
│   ├── release-note-surfaces.md
│   ├── setup.md
│   └── version-decisions.md
└── scripts/
    ├── adapters/
    ├── check-fork-sync.sh
    ├── eval.ts
    └── tests/
```

Top-level repository documentation may provide installation examples, but the
installed skill must not depend on repository-level scripts or configuration.

## Canonical Instruction Ownership

`SKILL.md` is the routing and core-workflow layer. It contains only:

- trigger metadata;
- the current integer guidance version;
- the initial setup checkpoint;
- a short inspect, classify, edit, reconcile, and verify workflow;
- the reference routing table;
- non-negotiable authorization and scope boundaries.

Its target length is 120–150 lines. Detailed examples, inclusion matrices,
release rules, and exhaustive verification checks live in exactly one reference
file. The intended ownership is:

- `setup.md`: repo policy, first-run setup, agent signatures, and initial
  authorization choices;
- `guidance-updates.md`: user-readable deltas for each guidance version;
- `entry-classification.md`: customer/developer classification, detail budget,
  wording, grouping, hot fixes, and superseded notes;
- `backfill.md`: historical reconstruction and guidance backfills;
- `release-lifecycle.md`: `Unreleased`, release intent, merges, and deployments;
- `version-decisions.md`: version policy and metadata alignment;
- `release-note-surfaces.md`: copy synchronization and authorized surface work;
- `automation-verification.md`: final checks and repo-native automation;
- `fork-maintenance.md`: fork provenance and sync behavior.

`EVAL.md` explains how to run, interpret, and extend evaluations. Structured
cases, rather than duplicated prose expectations, are canonical in
`evals/cases.json`.

The contract evaluator rejects identical normalized prose sequences of 18 or
more words shared between `SKILL.md` and a reference file, except for explicit
allowlisted syntax examples such as the policy schema, signature format, and
commands. This detects copied rules without treating short routing summaries as
duplication.

## Repository-Local Policy

On first use, the skill creates `.simple-changelogs.json` at the repository root
with this schema:

```json
{
  "schemaVersion": 1,
  "guidance": {
    "version": 2,
    "backfillStatus": "completed"
  },
  "developerChangelog": "required",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask"
}
```

The allowed `backfillStatus` values are `not-applicable`, `completed`,
`declined`, `deferred`, `partial`, and `failed`. The allowed release-note surface
values are `ask`, `allow`, and `existing-only`.

The policy is deliberately small and portable JSON. It stores decisions, not a
copy of the skill's detailed rules. A malformed or unsupported policy is
reported clearly and is not silently replaced.

The policy is repository behavior and should be committed with the changelogs
unless repository instructions explicitly classify it as local-only state.

## Initial Setup

Run initial setup when `.simple-changelogs.json` is absent and the user asks to
create, update, backfill, release, or adopt changelogs. A read-only
classification or explanation request does not authorize repository writes; in
that case, answer the question and offer setup without creating files.

During authorized initial setup:

1. Inspect repository instructions, existing changelogs, released headings,
   release-note data, and release policy.
2. Create `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` when missing. The developer
   changelog is required rather than optional for repositories adopting this
   skill.
3. If no released history exists, record the current guidance version with
   `backfillStatus: "not-applicable"`.
4. If released history exists, ask once whether to audit it against the current
   guidance. Record the response so another globally installed invocation does
   not ask again for the same repository and guidance version.
5. Set `newReleaseNoteSurfaces` to `ask`. New UI is never created during setup.

Initial setup should continue the user's requested changelog task after the
setup decision. A deferred or declined historical audit is not a blocker.

## Guidance Updates and Backfills

`SKILL.md` exposes a monotonically increasing integer guidance version. When the
repo policy records an older version, the skill loads the intervening entries
from `references/guidance-updates.md`, summarizes their effect, and asks once
whether to run a guidance backfill.

The response immediately records the new prompted version and status, preventing
repeated prompts. `deferred`, `partial`, and `failed` work can be resumed by an
explicit request, but do not generate an unsolicited prompt on every future
task. A later guidance version generates one new prompt.

When a backfill starts, record the prompted guidance version with
`backfillStatus: "partial"` before historical edits. Change it to `completed`
only after verification, or to `failed` after a handled failure. An interrupted
process therefore leaves an honest resumable state instead of appearing
complete.

Approval to run a backfill authorizes the audit and deterministic repairs:

- regenerate established derived release-note mirrors from unchanged sources;
- align exact copied version and date metadata when the source of truth is
  unambiguous;
- remove empty `Unreleased` headings and duplicate generated artifacts;
- report drift that cannot be repaired deterministically.

If the audit finds changes that alter the meaning, visibility, or release
boundary of public history, present those candidates as one reviewable batch and
request one additional approval. A current user command that already explicitly
authorizes rewriting, deleting, moving, collapsing, or reclassifying released
notes counts as that approval; do not ask twice for the same authority.

Moving information from a public note to an internal-only location is a public
visibility change, not an automatic information-preserving repair.

## Release-Note Surface Authorization

Updating an existing documented release-note data source or visible surface is
normal release-note work. Creating or wiring a new modal, route, screen,
navigation entry, dismissal store, or internal operator surface is product
implementation and requires either:

- an explicit current user request;
- documented repository policy; or
- repo policy value `newReleaseNoteSurfaces: "allow"`.

When the value is `ask` and a release first needs a missing surface, ask one
authorization question. Record approval as `allow` and rejection as
`existing-only`. A later explicit user request overrides either stored value for
the requested work.

An authenticated area is not automatically an authorized audience for developer
or security notes. Local access policy must establish the intended audience
before internal notes are rendered there.

## Agent Signatures

Raw `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` edits retain nearby agent
signatures by default. Use one machine-readable HTML comment for each contiguous
changed block or section:

```html
<!-- simple-changelogs-signature agent="Example Agent" at="2026-07-09T15:42:00-05:00" -->
```

Use only the exact agent or model identity exposed by the runtime. Never infer a
more specific version. When no identity is exposed, use `agent="unreported"`.
Use an ISO 8601 timestamp with local offset when the runtime can determine it;
otherwise use `at="unreported"` rather than inventing a time or offset.

Signatures are visible in raw source and are informational audit metadata, not
cryptographic authorship proof. Existing signatures are preserved. Release-note
renderers should ignore HTML comments generally rather than couple themselves
to one signature prefix.

## Pre-1.0 Policy

Use SemVer terminology precisely:

- `0.x.y` indicates initial development unless repository policy says otherwise;
- a SemVer pre-release has a suffix such as `-alpha`, `-beta`, or `-rc.1`;
- public distribution is established from repository and release evidence, not
  inferred from the major version alone.

Preserve the intentional quiet-changelog behavior during initial development:
routine repair churn, already-promised baseline fixes, narrow polish, and test
build cleanup normally stay out of customer notes. Publicly distributed `0.x`
releases still disclose material trust, access, payment, safety, compliance,
onboarding, or data-loss outcomes. Patch/minor guidance for `0.x` remains
context-sensitive and follows documented repository policy when present.

## Harness-Agnostic Behavior

The core skill and references do not assume:

- a writable installed skill directory;
- a specific agent vendor or CLI;
- availability of an exact model version;
- loader support for fork provenance or deduplication;
- a specific task, subagent, browser, or shell tool;
- model credentials for deterministic validation.

Vendor-specific installation examples remain valid in the public README.
Vendor-specific eval adapters are isolated under `scripts/adapters/`, implement
the same protocol, and have no authority over core behavior.

When both a repo-local fork and global upstream skill are discoverable, the
repo-local fork is authoritative by convention. The skill must not claim that a
loader can enforce this. If a runtime cannot resolve the conflict, repository
instructions should name the exact local skill and suppress the global copy.

## Hybrid Evaluation Harness

The Bun-based harness has two independent layers.

### Deterministic Contract Evaluation

`bun scripts/eval.ts contract` requires no model or credentials and checks:

- frontmatter shape and directory/name consistency;
- reference and bundled-script links;
- repo-policy example validity;
- guidance version coverage;
- canonical ownership and bounded duplication between `SKILL.md` and references;
- absence of installed-skill self-modification;
- absence of implicit new-UI authorization;
- absence of vendor assumptions outside isolated adapters and public install
  examples;
- eval case schema validity;
- fork helper availability and shell syntax.

### Portable Behavior Evaluation

`evals/cases.json` contains the existing trigger and behavior cases in a
versioned schema. Cases may assert:

- whether automatic activation is expected;
- created, modified, or absent files;
- required or forbidden file content;
- final-response decisions and reason codes;
- policy state transitions;
- release lifecycle state;
- signature placement and format.

The migration covers all 16 current trigger prompts and all 29 current behavior
cases. New behavior is not considered protected until it has a structured case
or deterministic contract assertion.

Behavior cases run in fresh temporary Git repositories copied from
`evals/fixtures/`. The harness inspects actual final files and responses. It does
not initially use an LLM judge; deterministic assertions keep results
reproducible.

The core invokes an adapter executable without a shell. The adapter reads one
versioned JSON request from stdin and emits one versioned JSON response to
stdout; diagnostic logs use stderr. The request includes the case, prompt, skill
directory, isolated workspace, activation mode, timeout, and expected response
schema. The response includes status, final response, runtime identity when
available, and diagnostic metadata.

Adapters own harness-specific installation, activation, authentication, and
workspace flags. Bundled Codex and Claude CLI adapters serve as equal examples.
Any other runtime can supply an external adapter implementing the same protocol.
The core does not import vendor APIs.

Supported entry points are:

```bash
bun scripts/eval.ts contract
bun scripts/eval.ts trigger --adapter scripts/adapters/codex.ts
bun scripts/eval.ts behavior --adapter scripts/adapters/claude.ts
bun scripts/eval.ts all --adapter /path/to/another-adapter
```

Text output is the default and JSON output is available for CI. Exit status `0`
means all selected cases passed, `1` means assertions failed, and `2` means the
harness, case data, adapter, or configuration was invalid.

## Isolation and Error Handling

- Behavior cases default to sequential execution to avoid rate-limit and shared
  state surprises.
- Every case receives a fresh temporary Git repository.
- Adapters receive only the case workspace and should request workspace-scoped
  permissions.
- Adapter commands use argument arrays and never interpolate through a shell.
- Successful workspaces are deleted. A debug option retains failed workspaces.
- Adapter absence or authentication failure is an explicit configuration error,
  not a failed behavior assertion.
- Contract evaluation remains available when no behavior adapter is installed.
- Malformed repo policy, eval data, or adapter output is reported without
  destructive repair.

## Fork Helper Bundling

Move `scripts/check-fork-sync.sh` into the installed skill's `scripts/`
directory. The helper accepts an explicit upstream ref and otherwise resolves
the remote default branch. It must not compare against arbitrary local `HEAD`.
It verifies that the pinned commit is usable for the comparison and distinguishes
current, behind, divergent, and invalid states.

Its exit codes are `0` for current, `1` for behind, `2` for invalid usage,
configuration, pin, or ref, and `3` for a divergent pin that is not an ancestor
of the selected upstream ref.

The prose reference explains when and why to use the bundled helper. It does not
ask agents to recreate deterministic shell logic. The runnable eval suite covers
the helper's success, behind, malformed-pin, missing-ref, and feature-branch
cases.

## Verification Strategy

Implementation follows test-driven development:

1. Add failing tests for policy validation and state transitions.
2. Add failing contract tests for the current self-modifying notice, duplicated
   rules, and implicit UI creation.
3. Add failing tests for the adapter protocol and isolated fixture execution.
4. Implement the minimum harness needed to pass them.
5. Migrate all existing prose eval cases into structured data and verify schema
   coverage.
6. Refactor the skill and references while keeping contract and behavior cases
   green.
7. Move and harden the fork helper under failing shell integration tests.
8. Run the bundled skill validator, static security scanner, contract suite,
   script tests, and representative behavior cases through both bundled
   adapters.

Behavior evaluation that consumes authenticated model capacity is reported
separately from credential-free contract verification.

## Success Criteria

- A global installation can serve multiple repositories without modifying
  itself or sharing repository state.
- Initial setup consistently creates and maintains both changelogs.
- A repository receives at most one unsolicited prompt per guidance version.
- Existing release-note surfaces update normally; new product UI requires stored
  or explicit authorization.
- Agent signatures remain useful, portable, and honestly described.
- Public `0.x` releases retain quiet repair notes without being mislabeled as
  SemVer pre-releases.
- `SKILL.md` becomes a concise routing layer with no material rule duplication.
- The installed directory contains every helper referenced by the skill.
- Contract evaluation runs with Bun and no model credentials.
- Behavior evaluation runs through a versioned adapter protocol rather than a
  privileged Codex-only path.
