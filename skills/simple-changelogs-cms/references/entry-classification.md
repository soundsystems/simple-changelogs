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
- general public web changes, mobile-only changes, store notes, and package or
  developer work that does not change an authorized operator's responsibilities;
- secrets, personal data, access tokens, internal credentials, or detailed
  vulnerability mechanics;
- speculative release claims, invented versions, and dates not supported by
  tags, metadata, merge history, or deployment evidence.

## Operator relevance gate

For every candidate, name the operator action, decision, support duty, workflow,
content model, permission, integration, reliability expectation, or safe
recovery step that changed. If none changed, omit the item even when it shipped
in the same repository, release, or version as CMS work.

Shared backend or customer-facing work belongs only when authenticated
operators must configure it, manage its content, answer users about it, or
change their operating procedure. Do not infer CMS relevance from a broad
heading or keyword; use changed paths, ownership, imports, tests,
documentation, and release metadata.

## Write entries

Use a short outcome title, one plain-language summary, and a compact list of
specific changes. Combine related commits into the capability or workflow an
operator experiences. Keep technical names only when operators see or use them.

Never use an em dash in newly authored or edited release notes, changelog
entries, tester instructions, store update notes, or operator notes unless the
user explicitly requests it. Rewrite with commas, colons, periods, parentheses,
or separate sentences. Repository house style alone does not create an
exception. Preserve untouched released history.

Use `kind: "release"` for an ordinary recorded release and `kind: "backfill"`
for history reconstructed after the fact. A backfilled entry may still include
a proven version. Do not change `kind` merely to make old work look newly
shipped.
