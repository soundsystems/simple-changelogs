# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Use the repository
host's private security-reporting channel at
<https://gitlab.com/soundsystems/simple-changelogs>. Include the affected
guidance version, a minimal reproduction, impact, and any known mitigations.

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
