# Contributing

Thanks for helping make release-history skills safer and easier to understand.
Development happens at <https://gitlab.com/soundsystems/simple-changelogs>;
the GitHub mirror is read-only, so open issues and merge requests on GitLab.

1. Open an issue for behavior-contract changes so distribution-neutral behavior
   can be discussed before a distribution depends on it. Check `.out-of-scope/`
   first: it records requests already declined and why, so a proposal to
   reverse one should answer the recorded reason.
2. Install dependencies with `bun install`.
3. Keep normative workflow rules in one canonical reference. Link to them from
   distribution notes instead of copying them.
4. Add a credential-free fixture and test for every behavior change.
5. Run `bun run check` before opening a merge request; it runs `bun run
   typecheck`, `bun run lint`, `bun run test`, and `bun run eval`.
6. Before merging, run `bun run check:receipt` on a clean checkout of the
   exact head. It installs from the lockfile, runs `bun run check`, and only
   when that exits 0 writes `<git common dir>/check-receipts/<HEAD>.json`:
   `{"command": "bun run check", "exitCode": 0, "finishedAt": "<UTC>",
   "head": "<40-hex HEAD>", "schemaVersion": 1}`. The repository has no CI,
   so `.simple-changes.json` registers `tooling/exec-guard.ts` as its
   `execGuard`: under `simple-changes loop exec`, a provider merge pinned to
   a head (`glab api .../merge_requests/<iid>/merge -f sha=<head>`, `glab mr
   merge --sha`), a `git merge` into `main`, or a `git push` that updates
   `main` runs only when that head has a receipt. Every other command passes.

Distribution boundaries are evidence-based. A distribution owns only the
audiences and release surfaces its `SKILL.md` claims; shared behavior lives in
the references it bundles, and `bun run eval` verifies every selectable package
boundary.

Design plans and specs stay in contributors' local `docs/plans/` and
`docs/specs/`, which Git ignores.
Record shipped decisions in the changelogs and the skill references instead.

Never include credentials, environment values, or customer data in fixtures,
logs, merge requests, or receipts.
