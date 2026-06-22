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
turning the developer changelog into a raw commit log.

## Install

Use the [Skills CLI](https://skills.sh/docs) with `bunx` or `pnpx`:

```bash
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
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
location. For manual installs, copy `SKILL.md` into the skill directory your
agent reads.

### Hermes

```bash
mkdir -p ~/.hermes/skills/simple-changelogs
cp SKILL.md ~/.hermes/skills/simple-changelogs/SKILL.md
```

### Eve (Vercel)

Place the skill in your agent's `.vercel/skills` directory:

```bash
mkdir -p .vercel/skills/simple-changelogs
cp SKILL.md .vercel/skills/simple-changelogs/SKILL.md
```

### Other Agents

```bash
# Codex
mkdir -p ~/.codex/skills/simple-changelogs
cp SKILL.md ~/.codex/skills/simple-changelogs/SKILL.md

# Claude Code
mkdir -p ~/.claude/skills/simple-changelogs
cp SKILL.md ~/.claude/skills/simple-changelogs/SKILL.md

# Cursor
mkdir -p ~/.cursor/skills/simple-changelogs
cp SKILL.md ~/.cursor/skills/simple-changelogs/SKILL.md
```

For project-local installs, use the project skill directory your agent supports:

```bash
# Shared project agent directory used by several agents
mkdir -p .agents/skills/simple-changelogs
cp SKILL.md .agents/skills/simple-changelogs/SKILL.md

# Cursor project directory
mkdir -p .cursor/skills/simple-changelogs
cp SKILL.md .cursor/skills/simple-changelogs/SKILL.md
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

## Files

- `SKILL.md` - the agent skill.
- `README.md` - public usage notes for this repository.
