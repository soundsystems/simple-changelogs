# Simple Changelogs CMS Evaluation

The repository-only CMS harness has deterministic schema and repository checks
plus four behavior prompts in `evals/evals.json`. The runtime validator remains
inside the installable CMS distribution; these tests and fixtures do not.

Run:

```bash
bun tooling/simple-changelogs-cms/scripts/test.ts
bun skills/simple-changelogs-cms/scripts/validate.ts \
  tooling/simple-changelogs-cms/evals/fixtures/valid-repo
```

The tests cover valid and invalid policy data, changelog ordering, stable IDs,
route constraints, and repository path containment. The behavior prompts cover
first-time authenticated setup, an authorized historical backfill, and a
request that must not leak CMS history into a public destination. They also
cover a mixed monorepo release where unrelated web, mobile, migration, and
developer work must stay out of the CMS operator history.
