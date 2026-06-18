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
# Cursor example (global, non-interactive)
bunx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs -a cursor -g -y

# Same install with pnpm
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --skill simple-changelogs -a cursor -g -y

# List skills in this repo before installing
pnpx skills add https://gitlab.com/soundsystems/simple-changelogs --list
```

Install to the current project instead of globally by omitting `-g`.

Other agents: replace `-a cursor` with your agent, or use `--all` to install
everywhere the CLI detects.

## skills.sh discovery

There is no manual submission or scraping step. [skills.sh](https://skills.sh)
ranks skills from anonymous install telemetry sent by the Skills CLI when
people run `skills add`.

After installs accumulate, this repo should appear on the leaderboard. The
README badge above links to the skills.sh page once indexing picks it up.

If the badge or leaderboard page is not live yet, installs still work from the
GitLab URL above.

## Manual install

Copy the skill file into your agent's skill directory. For Cursor:

```bash
mkdir -p ~/.cursor/skills/simple-changelogs
cp skills/simple-changelogs/SKILL.md ~/.cursor/skills/simple-changelogs/SKILL.md
```

For a project skill:

```bash
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
