# Contributing

Thanks for helping make release-history skills safer and easier to understand.

1. Open an issue for behavior-contract changes so distribution-neutral behavior
   can be discussed before a distribution depends on it.
2. Install dependencies with `bun install`.
3. Keep normative workflow rules in one canonical reference. Link to them from
   distribution notes instead of copying them.
4. Add a credential-free fixture and test for every behavior change.
5. Run `bun run check` before opening a change proposal.

Distribution boundaries are evidence-based. A distribution owns only the
audiences and release surfaces its `SKILL.md` claims; shared behavior lives in
the references it bundles, and `bun run eval` verifies every selectable package
boundary.

Use real Markdown newlines in proposal descriptions and re-read the stored body
after creation. Never include credentials, environment values, or customer data
in fixtures, logs, or receipts.
