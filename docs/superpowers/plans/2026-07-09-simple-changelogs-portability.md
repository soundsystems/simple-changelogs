# Simple Changelogs Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `subagent-driven-development` (recommended) or `executing-plans` to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a harness-agnostic `simple-changelogs` skill with repo-local
guidance state, explicit UI authorization, bundled fork tooling, and a runnable
hybrid evaluation harness.

**Architecture:** Keep `SKILL.md` as a concise router and move each detailed
policy to one reference owner. Use dependency-free TypeScript under Bun for
contract evaluation, fixture orchestration, deterministic assertions, and a
versioned JSON adapter protocol; isolate Codex and Claude behavior behind equal
optional adapters.

**Tech Stack:** Bun 1.3.13, TypeScript, `bun:test`, Biome 2.3+ through
Ultracite, POSIX shell, Git.

## Global Constraints

- Use Bun commands and `bunx`; do not introduce npm, npx, ESLint, Prettier, or
  another formatter.
- The installed `skills/simple-changelogs/` directory must contain every runtime
  script, schema, fixture, and reference it needs.
- Core skill instructions, schemas, fixtures, and harness code must not assume a
  particular agent vendor.
- Vendor-specific behavior is allowed only in isolated adapters and public
  installation examples.
- Contract evaluation must run without model credentials or network access.
- A read-only changelog question must not create `.simple-changelogs.json` or
  changelog files.
- Existing public history may be changed automatically only by deterministic,
  meaning-preserving synchronization.
- Preserve one truthful, machine-readable agent signature per contiguous raw
  changelog edit.
- Follow test-driven development: each production function is preceded by a
  focused failing test and an observed expected failure.

---

## File Map

- Create `package.json`, `tsconfig.json`, and `biome.jsonc` for repository-local
  Bun, TypeScript, Biome, and Ultracite verification.
- Create `skills/simple-changelogs/scripts/lib/types.ts` for shared protocol and
  manifest types.
- Create `skills/simple-changelogs/scripts/lib/validate.ts` for policy,
  manifest, request, and response validation.
- Create `skills/simple-changelogs/scripts/lib/contracts.ts` for deterministic
  skill-package checks.
- Create `skills/simple-changelogs/scripts/lib/adapter.ts` for shell-free adapter
  execution and timeout handling.
- Create `skills/simple-changelogs/scripts/lib/fixtures.ts` for isolated fixture
  repositories and assertions.
- Create `skills/simple-changelogs/scripts/eval.ts` for CLI orchestration and
  reporting.
- Create focused Bun tests under
  `skills/simple-changelogs/scripts/tests/`.
- Create versioned JSON schemas under `skills/simple-changelogs/evals/schemas/`.
- Create the canonical manifest at `skills/simple-changelogs/evals/cases.json`
  and reusable fixture repositories under
  `skills/simple-changelogs/evals/fixtures/`.
- Create equal optional adapters at
  `skills/simple-changelogs/scripts/adapters/codex.ts` and
  `skills/simple-changelogs/scripts/adapters/claude.ts`.
- Move `scripts/check-fork-sync.sh` to
  `skills/simple-changelogs/scripts/check-fork-sync.sh`.
- Create `references/setup.md` and `references/guidance-updates.md`; refactor all
  existing skill/reference/eval documentation around canonical ownership.
- Update `README.md`, `CHANGELOG.md`, and `DEVELOPER_CHANGELOG.md` for the shipped
  behavior and complete installed-package instructions.

---

### Task 1: Establish the Bun and Ultracite toolchain

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.jsonc`
- Create: `bun.lock`

**Interfaces:**

- Produces scripts `test`, `typecheck`, `lint`, `format`, `eval`, and
  `validate:biome` for every later task.

- [ ] **Step 1: Add repository metadata and scripts**

```json
{
  "name": "simple-changelogs",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.13",
  "scripts": {
    "eval": "bun skills/simple-changelogs/scripts/eval.ts contract",
    "format": "ultracite fix",
    "lint": "ultracite check",
    "test": "bun test skills/simple-changelogs/scripts/tests",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install exact development tools with Bun**

Run:

```bash
bun add --dev @biomejs/biome@2.5.3 @types/bun@1.3.14 typescript@7.0.2 ultracite@7.9.3
```

Expected: `package.json` gains exact-compatible dev dependencies and `bun.lock`
is created without lifecycle-script warnings.

- [ ] **Step 3: Configure strict no-emit TypeScript**

```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "lib": ["ESNext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "strict": true,
    "target": "ES2022",
    "types": ["bun"]
  },
  "include": ["skills/simple-changelogs/scripts/**/*.ts"]
}
```

- [ ] **Step 4: Configure Biome through Ultracite**

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.3/schema.json",
  "extends": ["ultracite/biome/core"],
  "files": {
    "includes": ["**", "!docs/superpowers/**"]
  }
}
```

- [ ] **Step 5: Validate configuration**

Run:

```bash
python3 /Users/jaay/.agents/skills/biome-validator/scripts/validate.py --root . --strict
bunx ultracite doctor
```

Expected: Biome 2.3+ schema and Ultracite installation validate; no ESLint or
Prettier configuration is detected.

- [ ] **Step 6: Commit the toolchain**

```bash
git add package.json tsconfig.json biome.jsonc bun.lock
git commit -m "build: Add Bun and Ultracite toolchain"
```

---

### Task 2: Define and validate portable data contracts

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/validate.test.ts`
- Create: `skills/simple-changelogs/scripts/lib/types.ts`
- Create: `skills/simple-changelogs/scripts/lib/validate.ts`
- Create: `skills/simple-changelogs/evals/schemas/repo-policy.schema.json`
- Create: `skills/simple-changelogs/evals/schemas/eval-manifest.schema.json`
- Create: `skills/simple-changelogs/evals/schemas/runner-request.schema.json`
- Create: `skills/simple-changelogs/evals/schemas/runner-response.schema.json`

**Interfaces:**

- Produces `validateRepoPolicy`, `validateManifest`, `validateRunnerRequest`, and
  `validateRunnerResponse`, each returning `{ ok: true, value }` or
  `{ ok: false, errors }` without mutating input.
- Defines protocol version `1` and manifest version `1`.

- [ ] **Step 1: Write failing validator tests**

```typescript
import { describe, expect, test } from "bun:test";
import {
  validateRepoPolicy,
  validateRunnerRequest,
  validateRunnerResponse,
} from "../lib/validate.ts";

describe("repo policy", () => {
  test("accepts the portable version-one policy", () => {
    const result = validateRepoPolicy({
      schemaVersion: 1,
      guidance: { version: 2, backfillStatus: "completed" },
      developerChangelog: "required",
      signatures: "agent-and-timestamp",
      newReleaseNoteSurfaces: "ask",
    });
    expect(result.ok).toBe(true);
  });

  test("rejects unknown status and preserves the original object", () => {
    const input = {
      schemaVersion: 1,
      guidance: { version: 2, backfillStatus: "done" },
    };
    const snapshot = structuredClone(input);
    const result = validateRepoPolicy(input);
    expect(result.ok).toBe(false);
    expect(input).toEqual(snapshot);
  });
});

test("runner contracts reject incompatible protocol versions", () => {
  expect(validateRunnerRequest({ protocolVersion: 2 }).ok).toBe(false);
  expect(validateRunnerResponse({ protocolVersion: 2 }).ok).toBe(false);
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/validate.test.ts`

Expected: FAIL because `../lib/validate.ts` does not exist.

- [ ] **Step 3: Implement discriminated types and explicit validators**

Define these core types without `any`:

```typescript
export type BackfillStatus =
  | "not-applicable"
  | "completed"
  | "declined"
  | "deferred"
  | "partial"
  | "failed";

export type SurfacePolicy = "ask" | "allow" | "existing-only";
export type ActivationMode = "discover" | "explicit";
export type EvalSuite = "trigger" | "behavior";
export type RunnerStatus = "completed" | "skipped" | "error";

export interface RepoPolicy {
  schemaVersion: 1;
  guidance: { version: number; backfillStatus: BackfillStatus };
  developerChangelog: "required";
  signatures: "agent-and-timestamp";
  newReleaseNoteSurfaces: SurfacePolicy;
}
```

Implement object guards, integer checks, enum checks, unknown-key reporting, and
JSON-path error messages. Keep JSON Schema documents aligned with these types.
The runner response carries an evaluation-only report separate from normal final
prose, with decision codes, reason codes, authorization records, version-map
records, verification results, and optional native activation evidence. Validate
uppercase extensible codes without treating self-report as proof of mutations.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests/validate.test.ts
bun run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit portable contracts**

```bash
git add skills/simple-changelogs/evals/schemas skills/simple-changelogs/scripts/lib skills/simple-changelogs/scripts/tests/validate.test.ts
git commit -m "feat(eval): Add portable evaluation contracts"
```

---

### Task 3: Implement shell-free adapter execution

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/adapter.test.ts`
- Create: `skills/simple-changelogs/scripts/lib/adapter.ts`

**Interfaces:**

- Consumes `RunnerRequest` and validates `RunnerResponse`.
- Produces `runAdapter(adapterPath, request, options)` with timeout, stderr
  capture, and `.ts` adapter execution through the current Bun binary.

- [ ] **Step 1: Write failing tests with temporary fake adapters**

Cover valid JSON stdout, logs on stderr, malformed JSON, non-zero exit,
incompatible protocol version, and timeout termination. Assert the subprocess
argument vector contains no shell executable or command interpolation.

- [ ] **Step 2: Run the test and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/adapter.test.ts`

Expected: FAIL because `runAdapter` does not exist.

- [ ] **Step 3: Implement the adapter runner**

Use `Bun.spawn({ cmd, stdin: "pipe", stdout: "pipe", stderr: "pipe" })`.
For `.ts` files set `cmd` to `[process.execPath, adapterPath]`; otherwise use
`[adapterPath]`. Serialize one JSON request plus a trailing newline to stdin,
close stdin, and parse the complete stdout as one response. Kill the process on
timeout and return a typed configuration error.

- [ ] **Step 4: Verify RED becomes GREEN**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests/adapter.test.ts
bun run typecheck
```

Expected: PASS; timeout test completes without leaving a child process.

- [ ] **Step 5: Commit adapter execution**

```bash
git add skills/simple-changelogs/scripts/lib/adapter.ts skills/simple-changelogs/scripts/tests/adapter.test.ts
git commit -m "feat(eval): Add neutral adapter protocol runner"
```

---

### Task 4: Build deterministic contracts and CLI reporting

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/contracts.test.ts`
- Create: `skills/simple-changelogs/scripts/tests/eval-cli.test.ts`
- Create: `skills/simple-changelogs/scripts/lib/contracts.ts`
- Create: `skills/simple-changelogs/scripts/eval.ts`

**Interfaces:**

- Produces `evaluateContracts(skillDirectory): Promise<ContractFinding[]>`.
- Produces CLI commands `contract`, `trigger`, `behavior`, and `all` with
  `--adapter`, `--case`, `--format text|json`, `--keep-failures`, and
  `--timeout-ms`.
- Uses exit `0` for pass, `1` for assertion failures, and `2` for invalid
  harness, adapter, or configuration.

- [ ] **Step 1: Write failing contract tests against tiny fixture skills**

Test valid frontmatter, missing references, invalid policy examples, missing
guidance update entries, 18-word normalized duplication, self-modifying installed
skill instructions, implicit UI creation, vendor assumptions in core files,
missing bundled helpers, invalid shell syntax, and malformed eval manifests.

- [ ] **Step 2: Run contract tests and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/contracts.test.ts`

Expected: FAIL because `evaluateContracts` does not exist.

- [ ] **Step 3: Implement contract evaluators**

Ignore fenced syntax blocks when checking 18-word prose duplication and allowlist
the policy, signature, and command examples. Scan vendor assumptions only in
`SKILL.md`, `EVAL.md`, non-adapter scripts, schemas, fixtures, and references;
vendor adapters and top-level README examples are intentionally excluded.

- [ ] **Step 4: Write CLI tests before CLI implementation**

Spawn `bun eval.ts contract --format json` against a known-good temporary skill
and assert JSON output plus exit `0`; repeat with one finding and assert exit `1`.
Assert unknown commands and missing adapters exit `2`.

- [ ] **Step 5: Run CLI tests and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/eval-cli.test.ts`

Expected: FAIL because the CLI entry point does not exist.

- [ ] **Step 6: Implement CLI parsing and reporters**

Use explicit argument parsing with no dependency or shell evaluation. Text output
prints suite, counts, and findings; JSON output emits one versioned report object.

- [ ] **Step 7: Run tests, types, and lint**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests/contracts.test.ts skills/simple-changelogs/scripts/tests/eval-cli.test.ts
bun run typecheck
bun run lint
```

Expected: PASS with no lint findings.

- [ ] **Step 8: Commit contract evaluator and CLI**

```bash
git add skills/simple-changelogs/scripts
git commit -m "feat(eval): Add deterministic contract evaluator"
```

---

### Task 5: Add isolated fixtures and deterministic behavior assertions

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/fixtures.test.ts`
- Create: `skills/simple-changelogs/scripts/lib/fixtures.ts`
- Create: `skills/simple-changelogs/evals/fixtures/minimal-git/`
- Create: `skills/simple-changelogs/evals/fixtures/dual-changelog/`
- Create: `skills/simple-changelogs/evals/fixtures/release-repo/`
- Create: `skills/simple-changelogs/evals/fixtures/routed-app/`
- Create: `skills/simple-changelogs/evals/fixtures/mobile-monorepo/`
- Create: `skills/simple-changelogs/evals/fixtures/skill-package/`
- Create: `skills/simple-changelogs/evals/fixtures/forked-skill/`

**Interfaces:**

- Produces `createFixtureWorkspace`, `initializeFixtureGit`,
  `evaluateAssertions`, and `cleanupFixtureWorkspace`.
- Supports assertion kinds for activation, adapter/report status, decision and
  authorization codes, paths, changed-path allowlists, text matching, Markdown
  headings/items/order/signatures, JSON pointers/equality, shell-free command
  exits, repository state, and stable normalized snapshots.

- [ ] **Step 1: Write failing fixture and assertion tests**

Test fresh temp directories, copied dotfiles, initialized Git history, path
traversal rejection, all assertion kinds, retained failed workspaces, and cleanup
of successful workspaces.

- [ ] **Step 2: Run tests and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/fixtures.test.ts`

Expected: FAIL because fixture helpers do not exist.

- [ ] **Step 3: Implement isolated workspaces and assertions**

Use `mkdtemp`, `cp`, `readFile`, `stat`, and `rm` from `node:fs/promises`; reject
absolute assertion paths and any normalized path that escapes the workspace.
Initialize Git through `Bun.spawn(["git", ...])` without a shell.

- [ ] **Step 4: Integrate behavior turns into `eval.ts`**

For each case, create one workspace, run turns sequentially through the adapter,
evaluate assertions after each turn, and update the report. If the adapter cannot
provide an activation trace, emit reason
`CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE` rather than inferring a trigger pass.

- [ ] **Step 5: Run all script tests**

Run: `bun test skills/simple-changelogs/scripts/tests`

Expected: PASS; no temp workspaces remain after successful tests.

- [ ] **Step 6: Commit fixture orchestration**

```bash
git add skills/simple-changelogs/evals/fixtures skills/simple-changelogs/scripts
git commit -m "feat(eval): Add isolated behavior fixtures"
```

---

### Task 6: Migrate every prose eval case into structured data

**Files:**

- Create: `skills/simple-changelogs/evals/cases.json`
- Modify: reusable files under `skills/simple-changelogs/evals/fixtures/`
- Create: `skills/simple-changelogs/scripts/tests/manifest-coverage.test.ts`

**Interfaces:**

- Consumes manifest version `1` and the assertion vocabulary from Task 5.
- Covers all 8 positive trigger prompts, 8 negative trigger prompts, and 29
  behavior cases from the existing `EVAL.md`.

- [ ] **Step 1: Write a failing coverage test**

Assert 16 unique trigger cases, 29 unique behavior cases, no skipped cases, valid
fixture IDs, at least one assertion per turn, and explicit coverage tags for
setup, signatures, backfill, surfaces, versions, lifecycle, forks, and wording.

- [ ] **Step 2: Run the coverage test and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/manifest-coverage.test.ts`

Expected: FAIL because `evals/cases.json` is absent.

- [ ] **Step 3: Add the canonical manifest and minimum reusable fixtures**

Represent multi-turn authorization cases explicitly. Update four stale prose
expectations while migrating:

1. Guidance updates write repo-local policy and never edit the installed skill.
2. A prompt explicitly authorizing released-history edits is not asked twice.
3. Missing UI with policy `ask` first reports authorization required; an
   approval turn records `allow` before implementation. A prompt explicitly
   asking to add the surface already grants that authority.
4. Fork-selection and trigger cases require an adapter activation trace; absence
   is reported as unavailable, not guessed.

Use seven composable bases (`minimal-git`, `dual-changelog`, `release-repo`,
`routed-app`, `mobile-monorepo`, `skill-package`, and `forked-skill`) plus small
case overlays rather than 29 copied repositories. Multi-step adapters preserve
the prior transcript or return `CAPABILITY_MULTI_STEP_UNAVAILABLE`.

- [ ] **Step 4: Run manifest and full unit suites**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests/manifest-coverage.test.ts
bun test skills/simple-changelogs/scripts/tests
```

Expected: PASS with exactly 45 canonical cases.

- [ ] **Step 5: Commit structured eval coverage**

```bash
git add skills/simple-changelogs/evals skills/simple-changelogs/scripts/tests/manifest-coverage.test.ts
git commit -m "test(skill): Make changelog behavior cases runnable"
```

---

### Task 7: Add equal optional Codex and Claude adapters

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/adapters.test.ts`
- Create: `skills/simple-changelogs/scripts/adapters/codex.ts`
- Create: `skills/simple-changelogs/scripts/adapters/claude.ts`
- Create: `skills/simple-changelogs/scripts/adapters/shared.ts`

**Interfaces:**

- Both adapters read one `RunnerRequest` JSON object from stdin and emit one
  `RunnerResponse` object to stdout.
- Both preserve vendor CLI logs on stderr, use the provided workspace, support
  classify and forced modes, and normalize authentication/configuration errors.

- [ ] **Step 1: Write failing command-builder and parser tests**

Test exact argument arrays for local Codex CLI 0.41.0 and Claude Code 2.1.177,
prompt construction for both activation modes, final-message extraction, CLI-not-
found errors, authentication failures, and preservation of diagnostic stderr.

- [ ] **Step 2: Run adapter tests and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/adapters.test.ts`

Expected: FAIL because adapter modules do not exist.

- [ ] **Step 3: Implement shared stdin, prompt, and response helpers**

Forced mode names the copied local skill explicitly. Classify mode asks the
runtime to decide whether the supplied skill metadata applies and requires an
activation trace in the normalized response. Neither adapter mutates global
agent configuration.

- [ ] **Step 4: Implement vendor subprocesses with argument arrays**

Codex uses `codex exec` with the provided working directory, workspace-write
sandbox, JSON events, and an output-last-message file. Claude uses print mode,
the provided working directory, JSON output, and explicit allowed workspace
tools. Keep exact vendor flags isolated in these two files.

- [ ] **Step 5: Run unit tests and opt-in smoke tests**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests/adapters.test.ts
bun skills/simple-changelogs/scripts/eval.ts trigger --adapter skills/simple-changelogs/scripts/adapters/codex.ts --case trigger-update-changelogs
bun skills/simple-changelogs/scripts/eval.ts trigger --adapter skills/simple-changelogs/scripts/adapters/claude.ts --case trigger-update-changelogs
```

Expected: unit tests pass; authenticated local smoke tests return activation
traces. If a CLI lacks authentication, report configuration exit `2` without
marking skill behavior failed.

- [ ] **Step 6: Commit optional adapters**

```bash
git add skills/simple-changelogs/scripts/adapters skills/simple-changelogs/scripts/tests/adapters.test.ts
git commit -m "feat(eval): Add Codex and Claude runner adapters"
```

---

### Task 8: Refactor the skill around repo-local policy and canonical owners

**Files:**

- Modify: `skills/simple-changelogs/SKILL.md`
- Create: `skills/simple-changelogs/references/setup.md`
- Create: `skills/simple-changelogs/references/guidance-updates.md`
- Modify: every existing file under `skills/simple-changelogs/references/`
- Modify: `skills/simple-changelogs/EVAL.md`

**Interfaces:**

- `SKILL.md` exposes `Current guidance version: 2`, stays between 120 and 150
  lines, and routes each detailed concern once.
- `setup.md` owns the policy schema, authorized setup flow, one-time prompts, and
  signature format.
- `EVAL.md` documents commands, adapter protocol, result interpretation, and
  case-authoring without repeating all case expectations.

- [ ] **Step 1: Run contract evaluation against the current skill and observe RED**

Run: `bun skills/simple-changelogs/scripts/eval.ts contract`

Expected: exit `1` for the self-modifying guidance notice, implicit UI creation,
missing setup/update references, missing bundled fork helper, duplicated prose,
and old eval format.

- [ ] **Step 2: Rewrite `SKILL.md` as the concise router**

Remove the self-modifying notice, full classification/detail lists, repeated
lifecycle/version/surface rules, and exhaustive verification bullets. Retain the
trigger description, guidance version, authorized setup checkpoint, short core
workflow, reference table, explicit new-UI boundary, and final verification
route.

- [ ] **Step 3: Add setup and guidance-update references**

Document `.simple-changelogs.json`, version-controlled state, read-only no-write
behavior, required developer changelog setup, status transitions, one prompt per
guidance version, surface values, and this signature shape:

```html
<!-- simple-changelogs-signature agent="Example Agent" at="2026-07-09T15:42:00-05:00" -->
```

Use `agent="unreported"` or `at="unreported"` rather than inventing unavailable
runtime data. Escape `&`, `"`, `<`, and `>` in runtime identities before writing
HTML attributes. Define `guidance.version` as the newest guidance version for
which the repository recorded a disposition, not proof that history conforms;
current guidance applies prospectively regardless of backfill status.

If the user never answers a setup or guidance question, do not invent a
disposition. A completed audit may still report intentionally unchanged semantic
candidates; reserve `partial` for unfinished work. An explicit one-off surface
request overrides `existing-only` for that task without changing ongoing policy
unless the user grants ongoing permission.

- [ ] **Step 4: Correct backfill, surface, SemVer, and fork rules**

Classify public-to-internal relocation as a visibility change. Treat explicit
current commands as approval. Require authorization before new UI or internal
surfaces and verify audience authorization. Describe `0.x.y` as initial
development, reserve pre-release for suffixes, and retain quiet public `0.x`
repair behavior with material trust/access/payment/safety/data-loss exceptions.
Stop claiming that loaders enforce fork precedence.

- [ ] **Step 5: Replace prose eval duplication with the runnable guide**

Document contract versus behavior suites, adapter protocol, exact commands,
exit codes, credential behavior, case schema, and extension workflow. Point to
`evals/cases.json` as canonical.

- [ ] **Step 6: Run contract, tests, types, and lint**

Run:

```bash
bun skills/simple-changelogs/scripts/eval.ts contract
bun test skills/simple-changelogs/scripts/tests
bun run typecheck
bun run lint
```

Expected: all pass; `SKILL.md` is 120–150 lines and contract duplication is zero.

- [ ] **Step 7: Commit the skill refactor**

```bash
git add skills/simple-changelogs
git commit -m "ref(skill): Make changelog policy repo-local"
```

---

### Task 9: Bundle and harden fork synchronization

**Files:**

- Create: `skills/simple-changelogs/scripts/tests/check-fork-sync.test.ts`
- Move: `scripts/check-fork-sync.sh` to
  `skills/simple-changelogs/scripts/check-fork-sync.sh`
- Modify: `skills/simple-changelogs/references/fork-maintenance.md`

**Interfaces:**

- Usage:
  `scripts/check-fork-sync.sh path/to/fork/SKILL.md /path/to/upstream origin/main`.
- Defaults the ref to the selected remote's symbolic default branch.
- Exits `0` current, `1` behind, `2` invalid, and `3` divergent.

- [ ] **Step 1: Write failing Git integration tests**

Create temporary upstream and fork repositories. Cover current, behind,
malformed pin, missing ref, divergent pin, and running from an unrelated feature
branch while the remote default branch remains authoritative.

- [ ] **Step 2: Run the integration test and observe RED**

Run: `bun test skills/simple-changelogs/scripts/tests/check-fork-sync.test.ts`

Expected: FAIL because the bundled helper is absent and the top-level helper
compares against local `HEAD`.

- [ ] **Step 3: Move and update the helper**

Resolve an explicit ref first; otherwise resolve the selected remote's symbolic
`HEAD`, then
`origin/main`, `main`, `origin/master`, or `master` only when present. Verify
ancestry with `git merge-base --is-ancestor`; return `3` for divergence. Keep
all paths quoted and pass refs as arguments rather than evaluated text.

- [ ] **Step 4: Run shell and integration verification**

Run:

```bash
sh -n skills/simple-changelogs/scripts/check-fork-sync.sh
bun test skills/simple-changelogs/scripts/tests/check-fork-sync.test.ts
```

Expected: PASS for all six repository states.

- [ ] **Step 5: Commit bundled fork tooling**

```bash
git add scripts/check-fork-sync.sh skills/simple-changelogs/scripts/check-fork-sync.sh skills/simple-changelogs/scripts/tests/check-fork-sync.test.ts skills/simple-changelogs/references/fork-maintenance.md
git commit -m "fix(forks): Bundle deterministic sync checker"
```

---

### Task 10: Update public documentation and release histories

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `DEVELOPER_CHANGELOG.md`

**Interfaces:**

- README installation copies the entire skill directory, including `scripts/`
  and `evals/`.
- README leads with agent-neutral installation and keeps Codex, Claude Code,
  Cursor, Hermes, and Eve as examples rather than requirements.

- [ ] **Step 1: Update README package and eval instructions**

Document initial `.simple-changelogs.json`, complete-directory manual copy,
contract command, adapter protocol, optional Codex/Claude examples, external
adapter use, and explicit CLI-auth prerequisites for model-backed evals.

- [ ] **Step 2: Finalize changelog entries**

Add customer-facing outcomes for repo-local guidance state, explicit UI
authorization, accurate pre-1.0 terminology, bundled fork checks, and runnable
portable evals. Expand the existing developer `Unreleased` entry with exact
script/schema/refactor details. Add one new-format signature per contiguous
changed block.

- [ ] **Step 3: Run documentation-sensitive contracts**

Run:

```bash
bun skills/simple-changelogs/scripts/eval.ts contract
git diff --check
```

Expected: PASS and no broken package paths.

- [ ] **Step 4: Commit public documentation**

```bash
git add README.md CHANGELOG.md DEVELOPER_CHANGELOG.md
git commit -m "docs: Document portable changelog skill setup"
```

---

### Task 11: Complete full validation and release readiness

**Files:**

- Modify only files required to resolve verified failures.

**Interfaces:**

- Produces a clean branch with reproducible contract, unit, lint, type, skill,
  security, and representative behavior verification.

- [ ] **Step 1: Format and lint with Ultracite/Biome**

Run:

```bash
bun run format
bun run lint
python3 /Users/jaay/.agents/skills/biome-validator/scripts/validate.py --root . --strict
```

Expected: no lint or configuration findings.

- [ ] **Step 2: Run unit, type, contract, and shell checks**

Run:

```bash
bun test skills/simple-changelogs/scripts/tests
bun run typecheck
bun skills/simple-changelogs/scripts/eval.ts contract
sh -n skills/simple-changelogs/scripts/check-fork-sync.sh
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Validate and security-scan the installed skill package**

Run:

```bash
python3 /Users/jaay/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/simple-changelogs
uv run /Users/jaay/.agents/skills/skill-scanner/scripts/scan_skill.py skills/simple-changelogs
```

Expected: skill validation succeeds and the scanner reports no unresolved
high-confidence security findings.

- [ ] **Step 4: Run representative model-backed behavior cases**

Run at least one trigger, one setup, one backfill, one surface-authorization,
one release-lifecycle, and one fork case through both available adapters. Treat
missing CLI authentication as a documented configuration limitation, not a
contract failure.

- [ ] **Step 5: Review the complete diff and working tree**

Run:

```bash
git status --short --branch
git diff main...HEAD --stat
git diff main...HEAD --check
git log --oneline main..HEAD
```

Expected: only intended files changed, no unstaged fixes remain, and every
commit is independently understandable.

If verification exposes a defect, return to the task that owns that behavior,
add or strengthen its failing regression test, apply the minimum fix, rerun the
full Task 11 sequence, and commit the correction with the owning task's scope.
