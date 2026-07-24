# CMS Entry Classification

Write for authenticated operators who manage content, support releases, or
maintain day-to-day product state.

## Include

- new or materially changed CMS workflows, controls, fields, and permissions;
- product changes operators must understand to manage content or answer users;
- migrations, integrations, storage changes, or reliability fixes that alter
  operator behavior;
- release boundaries, rollbacks, and compatibility changes supported by
  repository evidence;
- operational limitations and safe recovery steps that do not disclose
  credentials or exploitable detail.

## Omit

- raw commit lists, hashes, dependency churn, formatting, and test-only work;
- customer marketing copy or visual polish with no operator consequence;
- secrets, personal data, access tokens, internal credentials, or detailed
  vulnerability mechanics;
- speculative release claims, invented versions, and dates not supported by
  tags, metadata, merge history, or deployment evidence.

## Write entries

Use a short outcome title, one plain-language summary, and a compact list of
specific changes. Combine related commits into the capability or workflow an
operator experiences. Keep technical names only when operators see or use them.

Use `kind: "release"` for an ordinary recorded release and `kind: "backfill"`
for history reconstructed after the fact. A backfilled entry may still include
a proven version. Do not change `kind` merely to make old work look newly
shipped.
