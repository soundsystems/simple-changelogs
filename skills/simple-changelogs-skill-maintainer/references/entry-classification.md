# Skill-Repository Entry Classification

Classify outcomes by the audience that must remember them.

## Public changelog

Include durable changes that affect people who install, invoke, integrate, or
maintain a downstream fork of the skill:

- new or changed skill behavior, triggers, outputs, safety boundaries, or
  authority requirements;
- installation, runtime, dependency, compatibility, or platform changes;
- new selectable distributions or changed ownership between distributions;
- new read-only CLI capabilities or changed public schemas;
- bug fixes that repair a visible or materially unsafe skill outcome;
- deprecations, removals, migrations, and breaking changes.

Describe the adopter outcome and necessary action. Do not expose private
credentials, vendor internals, security-control details, unreleased roadmap, or
clone-enabling implementation mechanics.

Routine prose cleanup, formatting, typo fixes, test-only refactors, dependency
lockfile churn, and internal adapter maintenance do not need public entries
unless they change adoption or behavior.

## Developer changelog

Include context future maintainers should not reconstruct:

- eval cases, fixtures, graders, schemas, contract coverage, and harness design;
- model adapter behavior, sandbox boundaries, authentication assumptions, or
  capability limitations;
- package-shape rules, Skills CLI consumer checks, generated mirrors, and
  release automation;
- fork-provenance machinery, guidance-version decisions, and migration logic;
- architectural tradeoffs, parser details, security hardening, or non-obvious
  compatibility work.

One outcome belongs in both histories when adopters gain a visible capability
and maintainers need technical context. Use different detail budgets rather
than copying the same bullet.

## Grouping and wording

Group related files and commits into one outcome. Name the skill concept users
recognize and say what they can now do. Reserve “improved” for an existing
workflow; introduce new capabilities directly.

When `releaseNoteGrouping` is `product-areas`, collect related bullets under
short skill areas that adopters recognize, such as **Onboarding**, **Release
handoffs**, or **Compatibility**. Merge repeated areas across the release,
order them by adopter importance, and keep a singleton flat instead of creating
a one-bullet category merely for symmetry. Use **Bug Fixes & Improvements** only
as the final miscellaneous fallback.

Patch releases use **Bug Fixes & Improvements** as their sole release title and
keep all bullets flat; never repeat that title as a category. If the contents
need a capability or breaking-change story, correct the release level instead
of forcing them into a patch. When the preference is `flat`, feature-led nested
bullets remain allowed for several outcomes belonging to one named capability.

For fixes, state the repaired result without blame or incident detail. For a
breaking change, name the affected contract and the required migration.

Punctuate every entry and release-note line you write with commas, colons,
periods, or parentheses. When a sentence reaches for an em-dash, rewrite it for
what it needs (a list, a definition, an aside, or two sentences) instead of
swapping the character. Repository instructions that set a different house
style take precedence, and released entries keep their wording.

Compact packaged release notes select material public highlights. They do not
inherit every durable changelog entry and never include developer-only notes or
raw signature comments.
