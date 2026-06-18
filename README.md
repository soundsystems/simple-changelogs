# Simple Changelogs

[![skills.sh](https://skills.sh/b/soundsystems/simple-changelogs)](https://skills.sh/soundsystems/simple-changelogs)

An agent skill for maintaining simple, useful changelogs:

- `CHANGELOG.md` for customer-facing release notes.
- `DEVELOPER_CHANGELOG.md` for internal technical history.
- Bootstrap missing changelog files and backfill them from git history.
- Optional release-note data for in-app "What's New" surfaces, release pages,
  app store notes, or other product-facing release summaries.

The skill helps agents decide what belongs in each changelog, keep technical
details out of customer-facing notes, and preserve maintainer context without
turning the developer changelog into a raw commit log.

## Install

Use the [Skills CLI](https://skills.sh/docs) with `bunx` or `pnpx`:

```bash
# Codex (global, non-interactive)
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y

# Claude Code (global, non-interactive)
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent claude-code -g -y

# Cursor (global, non-interactive)
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent cursor -g -y

# Install for every supported agent the CLI detects
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent '*' -g -y
```

Use `pnpx` instead of `bunx` if that is your preferred package runner:

```bash
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs --agent codex -g -y
```

Install to the current project instead of globally by omitting `-g`. List the
skills in this repo before installing with:

```bash
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --list
```

## skills.sh discovery

There is no manual submission or scraping step. [skills.sh](https://skills.sh)
ranks skills from anonymous install telemetry sent by the Skills CLI when
people run `skills add`.

After installs accumulate, this repo should appear on the leaderboard. The
README badge above links to the skills.sh page once indexing picks it up.

If the badge or leaderboard page is not live yet, installs still work from the
GitLab URL above.

## Manual Install

The Skills CLI is preferred because it knows each agent's current skill
location. For manual installs, copy the skill file into the skill directory your
agent reads. Common locations are:

```bash
# Codex
mkdir -p ~/.codex/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md ~/.codex/skills/simple-changelogs/SKILL.md

# Claude Code
mkdir -p ~/.claude/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md ~/.claude/skills/simple-changelogs/SKILL.md

# Cursor
mkdir -p ~/.cursor/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md ~/.cursor/skills/simple-changelogs/SKILL.md
```

For project-local installs, use the project skill directory your agent supports:

```bash
# Shared project agent directory used by the Skills CLI for several agents
mkdir -p .agents/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md .agents/skills/simple-changelogs/SKILL.md

# Cursor project directory
mkdir -p .cursor/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md .cursor/skills/simple-changelogs/SKILL.md
```

## When To Use It

Use this skill when asking an agent to:

- Update `CHANGELOG.md`.
- Create `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md` when they do not exist yet.
- Backfill customer and developer changelogs from git history, tags, releases,
  package versions, or deployment milestones.
- Prepare release notes.
- Decide whether a change is customer-facing.
- Summarize technical changes for maintainers.
- Publish, merge, release, or deploy changes where changelog coverage should be
  checked first.

## What It Encourages

- Customer changelog entries that describe visible outcomes in plain language.
- Developer changelog entries that explain migrations, data model changes,
  parser behavior, tests, release-note structures, and process changes simply.
- Grouped feature entries when one feature includes several related changes.
- Explicit "no changelog needed" decisions for internal-only work.

## Files

- `skills/simple-changelogs/SKILL.md` - the agent skill.
- `README.md` - public usage notes for this repository.
