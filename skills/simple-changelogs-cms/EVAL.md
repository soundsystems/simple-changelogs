# Simple Changelogs CMS Evaluation

The focused package has deterministic schema and repository checks plus three
behavior prompts in `evals/evals.json`.

Run:

```bash
bun scripts/test.ts
bun scripts/validate.ts evals/fixtures/valid-repo
```

The tests cover valid and invalid policy data, changelog ordering, stable IDs,
route constraints, and repository path containment. The behavior prompts cover
first-time authenticated setup, an authorized historical backfill, and a
request that must not leak CMS history into a public destination.
