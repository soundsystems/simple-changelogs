# Simple Changelogs

[![skills.sh](https://skills.sh/b/soundsystems/simple-changelogs)](https://skills.sh/soundsystems/simple-changelogs)

An agent skill for maintaining simple, useful changelogs:

- `CHANGELOG.md` for customer-facing release notes.
- `DEVELOPER_CHANGELOG.md` for internal technical history.
- Bootstrap missing changelog files and backfill them from git history.
- Optional release-note data for documented product-facing "What's New" surfaces,
  release pages, app store notes, or other release summaries.
- Smart version bump decisions based on shipped impact, compatibility, and repo
  policy instead of calendar dates or implementation duration.

The skill helps agents decide what belongs in each changelog, keep technical
details out of customer-facing notes, and preserve maintainer context without
turning the developer changelog into a raw commit log. Detailed release,
versioning, and "What's New" behavior lives in focused reference files that
agents load only when the task needs them.

## Install

Use the [Skills CLI](https://skills.sh/docs) with `bunx` or `pnpx`:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
```

That command installs the complete `skills/simple-changelogs/` package from the
default branch, including `SKILL.md`, `EVAL.md`, and `references/`.

To install a branch or tag before it reaches the default branch, use the Git URL
with a ref:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs.git#<branch-or-tag> --skill simple-changelogs --agent codex -g -y
```

Use `pnpx` instead of `bunx` if preferred:

```bash
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
```

### Specific Agents

```bash
# Codex
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y

# Claude Code
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent claude-code -g -y

# Cursor
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent cursor -g -y

# All supported agents detected by the CLI
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent '*' -g -y
```

Install to the current project instead of globally by omitting `-g`. List the
skills in this repo before installing with:

```bash
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --list
```

## Manual Install

The Skills CLI is preferred because it knows each agent's current skill
location and installs the complete `skills/simple-changelogs/` directory. For
manual installs, copy that directory's `SKILL.md`, `EVAL.md`, and `references/`
into the skill directory your agent reads.

### Hermes

```bash
mkdir -p ~/.hermes/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md ~/.hermes/skills/simple-changelogs/
cp -R skills/simple-changelogs/references ~/.hermes/skills/simple-changelogs/
```

### Eve (Vercel)

Place the skill in your agent's `.vercel/skills` directory:

```bash
mkdir -p .vercel/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md .vercel/skills/simple-changelogs/
cp -R skills/simple-changelogs/references .vercel/skills/simple-changelogs/
```

### Other Agents

```bash
# Codex
mkdir -p ~/.codex/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md ~/.codex/skills/simple-changelogs/
cp -R skills/simple-changelogs/references ~/.codex/skills/simple-changelogs/

# Claude Code
mkdir -p ~/.claude/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md ~/.claude/skills/simple-changelogs/
cp -R skills/simple-changelogs/references ~/.claude/skills/simple-changelogs/

# Cursor
mkdir -p ~/.cursor/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md ~/.cursor/skills/simple-changelogs/
cp -R skills/simple-changelogs/references ~/.cursor/skills/simple-changelogs/
```

For project-local installs, use the project skill directory your agent supports:

```bash
# Shared project agent directory used by several agents
mkdir -p .agents/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md .agents/skills/simple-changelogs/
cp -R skills/simple-changelogs/references .agents/skills/simple-changelogs/

# Cursor project directory
mkdir -p .cursor/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md skills/simple-changelogs/EVAL.md .cursor/skills/simple-changelogs/
cp -R skills/simple-changelogs/references .cursor/skills/simple-changelogs/
```

## When To Use It

Use this skill when asking an agent to:

- Update `CHANGELOG.md`.
- Create `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md` when they do not exist yet.
- Backfill customer and developer changelogs from git history, tags, releases,
  package versions, or deployment milestones.
- Prepare release notes for documented user-facing release surfaces.
- Decide whether a change is customer-facing.
- Summarize technical changes for maintainers.
- Publish, merge, release, or deploy changes when the task or repo policy
  explicitly ties that work to changelog or release-note coverage.

## What It Encourages

- Customer changelog entries that describe visible outcomes in plain language.
- Developer changelog entries that explain migrations, data model changes,
  parser behavior, tests, release-note structures, and process changes simply.
- Grouped feature entries when one feature includes several related changes.
- Version bumps that distinguish patch, minor, major, and pre-1.0 release
  boundaries without forcing one team's policy onto every project.
- Explicit "no changelog needed" decisions for internal-only work.

## Forking For Your Project

This skill is designed to be forked into project repos as a repo-specific
changelog maintainer (renamed, with your product's audiences, policies, and
release surfaces baked in). To keep a fork syncable with upstream:

1. Record provenance in the fork's `SKILL.md`, directly under the title:

   ```md
   Forked from `simple-changelogs` @ `<short-sha>`. <project>-specific deltas:
   <audiences, policy sources, CLI workflows, release surfaces, ...>
   ```

2. When upstream improves, check what your fork is missing:

   ```bash
   scripts/check-fork-sync.sh path/to/your-fork/SKILL.md
   ```

   The script reads the fork's pinned sha, lists upstream skill commits since
   that pin, and shows the changed files. Exit code `1` means there is
   something to review; `0` means the fork is current.

3. Port what applies, keep your fork-specific deltas, and bump the pinned sha
   to the upstream commit you synced to. Improvements that are not
   project-specific are welcome back upstream as merge requests.

Agents get the same workflow from
`skills/simple-changelogs/references/fork-maintenance.md`, which the skill
loads when a task involves creating, editing, or syncing a fork.

## Files

- `skills/simple-changelogs/SKILL.md` - the agent skill.
- `scripts/check-fork-sync.sh` - checks a downstream fork's provenance pin
  against upstream skill history.
- `skills/simple-changelogs/references/` - focused guidance loaded only for
  relevant changelog, release-lifecycle, versioning, and release-note tasks.
- `skills/simple-changelogs/EVAL.md` - trigger and behavior eval prompts for
  improving the skill.
- `README.md` - public usage notes for this repository.
