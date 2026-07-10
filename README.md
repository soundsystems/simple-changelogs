# Simple Changelogs

[![skills.sh](https://skills.sh/b/soundsystems/simple-changelogs)](https://skills.sh/soundsystems/simple-changelogs)

An agent-neutral skill for maintaining two useful release histories:

- `CHANGELOG.md` explains shipped outcomes to customers.
- `DEVELOPER_CHANGELOG.md` preserves technical context for maintainers.

The skill classifies changes, bootstraps or backfills both files, makes
evidence-based version recommendations, and updates established release-note
destinations. It never treats ordinary UI work as permission to add a new
modal, route, screen, panel, or navigation entry.

## Install

Use the [Skills CLI](https://skills.sh/docs) to choose the project or global
scope and any supported agent targets:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs
```

For a non-interactive project install to every detected agent:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent '*' -y
```

Add `-g` for a global install. Use `pnpx` instead of `bunx` if preferred. To
install a branch or tag, use the Git URL with its ref:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs.git#<branch-or-tag> --skill simple-changelogs
```

Codex, Claude Code, and Cursor are optional explicit targets, not requirements:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent claude-code -g -y
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent cursor -g -y
```

List the repository's skills without installing them:

```bash
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --list
```

## First Repository Setup

On the first write-capable changelog task, the skill inspects the repository,
creates either missing changelog, and asks once how to handle existing released
history. It then stores the decision in one committed repo-local policy file:

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

Save it as `.simple-changelogs.json` at the repository root. The setup prompt
records the user's actual answer; silence never becomes an invented version or
backfill disposition. Read-only questions do not create or change project
files.

`newReleaseNoteSurfaces` may be `ask`, `allow`, or `existing-only`. Even with an
established changelog workflow, a new product-facing release-note surface needs
an explicit current request or documented repository permission.

## Manual Install

Copy the entire `skills/simple-changelogs/` directory. `SKILL.md` alone is not
the full package: the references, schemas, eval manifest, adapters, runner, and
fork checker are all bundled alongside it.

Shared project install:

```bash
mkdir -p .agents/skills
cp -R skills/simple-changelogs .agents/skills/
```

Agent-specific examples:

```bash
# Codex
mkdir -p ~/.codex/skills
cp -R skills/simple-changelogs ~/.codex/skills/

# Claude Code
mkdir -p ~/.claude/skills
cp -R skills/simple-changelogs ~/.claude/skills/

# Cursor
mkdir -p .cursor/skills
cp -R skills/simple-changelogs .cursor/skills/

# Hermes
mkdir -p ~/.hermes/skills
cp -R skills/simple-changelogs ~/.hermes/skills/

# Eve (Vercel)
mkdir -p .vercel/skills
cp -R skills/simple-changelogs .vercel/skills/
```

Use the skill directory supported by your runtime if it differs from these
examples.

## Run the Evaluation Harness

The bundled Bun harness is runtime-neutral at its core. Contract checks need
Bun, Git, and a POSIX shell, but no model or credentials:

```bash
bun skills/simple-changelogs/scripts/eval.ts contract
```

From inside an installed `simple-changelogs` directory, use
`bun scripts/eval.ts contract` instead. The command checks package structure,
schemas, instruction ownership, policy examples, manifest validity, shell
syntax, and vendor-coupling boundaries.

Trigger and behavior suites use a JSON stdin/stdout adapter. Optional adapters
for Codex and Claude Code are included:

```bash
bun skills/simple-changelogs/scripts/eval.ts trigger \
  --adapter skills/simple-changelogs/scripts/adapters/codex.ts

bun skills/simple-changelogs/scripts/eval.ts behavior \
  --adapter skills/simple-changelogs/scripts/adapters/claude.ts
```

These adapters use the CLI's existing local authentication; the skill does not
store API keys. Check or establish that authentication before running them:

```bash
codex login status
codex login

claude auth status
claude auth login
```

The Codex adapter uses the CLI's configured model and disables inherited MCP
servers for isolated runs. If that configured model is unavailable to the
installed CLI, select an available one for the command without editing the
skill:

```bash
SIMPLE_CHANGELOGS_CODEX_MODEL=<available-model-id> \
  bun skills/simple-changelogs/scripts/eval.ts behavior \
  --adapter skills/simple-changelogs/scripts/adapters/codex.ts
```

The Claude Code adapter has the equivalent
`SIMPLE_CHANGELOGS_CLAUDE_MODEL=<available-model-id>` override. The repository
does not declare provider model catalogs; valid IDs and aliases depend on the
installed CLIs and authenticated accounts.

Select a case with `--case <id>`, retain failed workspaces with
`--keep-failures`, or emit CI-friendly output with `--format json`. Missing CLI
authentication is a configuration error, not a failed skill behavior case.

An external adapter may use any model provider or agent harness. It must read
one `RunnerRequest` JSON object from stdin, write one `RunnerResponse` JSON
object to stdout, keep diagnostics on stderr, restrict edits to the supplied
workspace, and leave the skill package read-only. The exact protocol lives in
`evals/schemas/runner-request.schema.json` and
`evals/schemas/runner-response.schema.json`; see `EVAL.md` for commands, exit
codes, assertion types, and adapter guidance.

## When To Use It

Use the skill for explicit changelog, developer-history, release-note,
backfill, release-finalization, or release-version work. It also helps decide
whether a specific change belongs in customer or developer history.

It is not a generic trigger for every deploy, package bump, UI edit, commit
summary, or code review. Routine internal work can be classified as requiring
no changelog entry.

## What It Encourages

- Plain-language customer outcomes without clone-enabling implementation detail.
- Maintainer notes for migrations, data models, parsers, automation, tests, and
  release mechanics.
- Grouped entries for one feature instead of a noisy commit-by-commit log.
- Version decisions based on compatibility, shipped impact, and repository
  policy.
- Correct SemVer language: `0.x` is initial development, while prerelease means
  a suffix such as `1.0.0-beta.1`.
- Machine-readable identity and timestamp comments as an informational audit
  trail, without claiming cryptographic authorship.

## Forking For Your Project

A repo-specific fork can bake in product audiences, release surfaces, and local
commands while remaining syncable with upstream. Record provenance directly
under the fork's title:

```md
Forked from `simple-changelogs` @ `<short-sha>`. <project>-specific deltas:
<audiences, policy sources, CLI workflows, release surfaces, ...>
```

The repo-local fork should be authoritative for that repository. When a loader
cannot enforce local precedence, repository guidance should name the exact fork
and tell the agent not to apply the global upstream skill in the same task.

Check the fork's pinned commit against the upstream default branch:

```bash
skills/simple-changelogs/scripts/check-fork-sync.sh path/to/fork/SKILL.md
```

Exit `0` means current, `1` means behind, `2` means invalid input, and `3` means
the pin diverged from the selected upstream ref. Pass an upstream repository
and ref explicitly when the defaults are not appropriate:

```bash
skills/simple-changelogs/scripts/check-fork-sync.sh \
  path/to/fork/SKILL.md /path/to/upstream origin/main
```

Port applicable improvements, preserve intentional local deltas, and update the
pin after verification. Fork provenance is a convention and audit aid, not a
portable guarantee that every agent loader implements deduplication.

## Package Layout

- `skills/simple-changelogs/SKILL.md` — concise workflow and reference routing.
- `skills/simple-changelogs/references/` — focused policy and verification
  guidance.
- `skills/simple-changelogs/evals/` — canonical cases and closed JSON schemas.
- `skills/simple-changelogs/scripts/eval.ts` — contract and behavior runner.
- `skills/simple-changelogs/scripts/adapters/` — optional model CLI adapters.
- `skills/simple-changelogs/scripts/check-fork-sync.sh` — bundled fork checker.
- `skills/simple-changelogs/EVAL.md` — harness protocol and contributor guide.
