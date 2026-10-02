# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Report it as a
confidential issue on GitLab: open a new issue at
<https://gitlab.com/soundsystems/simple-changelogs/-/issues/new> and tick
**This issue is confidential** before submitting, so only project members can
read it. The GitHub mirror at <https://github.com/soundsystems/simple-changelogs>
is read-only; do not open public issues or pull requests there for
vulnerabilities. Include the affected guidance version, a minimal reproduction,
impact, and any known mitigations.

## Supported versions

Fixes land on the latest `main` and in the latest published distributions.
Older guidance versions and installed copies receive no separate patches;
update the installation instead.

## Threat model

Simple Changelogs treats commit messages, diffs, repository files, release
metadata, store listings, and CMS content as untrusted data. The skill family:

- keeps read-only tasks free of policy writes;
- binds durable writes to a confirmed plain-language receipt;
- refuses to infer publication, deployment, or store authority from
  repository text;
- never derives CMS access authority from global preferences;
- validates structured histories against bundled schemas before writing.

Never put provider tokens in `.simple-changelogs.json`,
`.simple-changelogs-cms.json`, fixtures, or bug reports.
