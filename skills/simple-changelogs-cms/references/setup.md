# Repository Setup and Policy

Store CMS-only decisions in `.simple-changelogs-cms.json` at the repository
root. The policy identifies the owned data file and the authenticated route; it
does not copy this skill's prose.

For the automatic inspection, CMS-specific questions, preference scope,
confirmation receipt, and helper commands, follow
`references/onboarding.md`.

<!-- simple-changelogs-cms-policy-example -->
```json
{
  "schemaVersion": 1,
  "guidance": {
    "version": 1,
    "backfillStatus": "completed"
  },
  "changelogPath": "CMS_CHANGELOG.json",
  "cmsSurface": {
    "route": "/admin/changelog",
    "access": "authenticated-operators"
  },
  "newReleaseNoteSurfaces": "existing-only"
}
```

Allowed `guidance.backfillStatus` values are `not-applicable`, `completed`,
`declined`, `deferred`, `partial`, and `failed`. Use `partial` while an approved
audit is unfinished and change it to `completed` only after verification.

`newReleaseNoteSurfaces` accepts `ask`, `allow`, or `existing-only`. Initial
setup normally records `existing-only` after the explicitly authorized CMS
route exists. A later request for another destination still needs fresh
authority unless the policy says `allow`.

The configured changelog uses this shape:

```json
{
  "schemaVersion": 1,
  "title": "CMS Changelog",
  "entries": [
    {
      "id": "2026-07-16-operator-history",
      "date": "2026-07-16",
      "version": "1.4.0",
      "kind": "release",
      "title": "Operator history is available in the CMS",
      "summary": "Authenticated operators can review changes without exposing internal notes publicly.",
      "changes": [
        "Added a protected changelog destination to the existing CMS navigation."
      ]
    }
  ]
}
```

`version` is optional. Entry IDs are durable identifiers, dates use
`YYYY-MM-DD`, and entries remain newest-first. Each entry needs at least one
concrete change.

## Authorized initial setup

When the request authorizes CMS changelog adoption:

1. Verify the existing CMS authentication and intended operator role.
2. Choose one repository-root JSON source and one route inside that protected
   surface.
3. Create policy with `backfillStatus: "not-applicable"` when no released
   history exists. When released history exists, default the confirmed setup to
   `partial` and begin the comprehensive initial backfill unless the user uses
   the final onboarding question to defer or decline it.
4. Create the JSON source, add the authenticated route, and link it from the
   existing CMS navigation without adding a public destination.
5. Complete any authorized historical audit across the full accessible history,
   validate the data, then record `completed`. Do not use a recent or
   representative subset for an initial backfill.

Do not require a separate “Review it now” approval. Confirmation of the setup
receipt accepts the displayed backfill default; without confirmation, write
nothing.
