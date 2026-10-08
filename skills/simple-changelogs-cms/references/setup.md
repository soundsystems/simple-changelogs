# Repository Setup and Policy

Store CMS-only decisions in `.simple-changelogs-cms.json` at the repository
root. The policy identifies the owned data file and the authenticated route; it
does not copy this skill's prose.

For the automatic inspection, CMS-specific questions, preference scope,
confirmation receipt, and helper commands, follow
`references/onboarding.md`.

## Contents

- Policy File
- Authorized initial setup
- One Prompt per Guidance Version
- Authoring preferences

## Policy File

<!-- simple-changelogs-cms-policy-example -->
```json
{
  "schemaVersion": 1,
  "guidance": {
    "version": 2,
    "backfillStatus": "completed"
  },
  "changelogPath": "CMS_CHANGELOG.json",
  "cmsSurface": {
    "route": "/admin/changelog",
    "access": "authenticated-operators"
  },
  "newReleaseNoteSurfaces": "existing-only",
  "newReleaseNoteSurfaceComponents": "project-components"
}
```

Allowed `guidance.backfillStatus` values are `not-applicable`, `completed`,
`declined`, `deferred`, `partial`, and `failed`. Use `partial` while an approved
audit is unfinished and change it to `completed` only after verification.

`newReleaseNoteSurfaces` accepts `ask`, `allow`, or `existing-only`. Initial
setup normally records `existing-only` after the explicitly authorized CMS
route exists. A later request for another destination still needs fresh
authority unless the policy says `allow`.

`newReleaseNoteSurfaceComponents` is optional and accepts
`project-components`, `recommended-web-components`,
`recommended-web-radix`, `platform-native-components`, or `minimal-markup`.
It records how an explicitly authorized operator surface is presented; it does
not grant a route, dependency, access boundary, deployment, or publication.
When absent, ask only after a surface is authorized.

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

## One Prompt per Guidance Version

When policy records older guidance, inspection exposes a `guidanceUpdate`.
Present **Simple Changelogs has recently been updated**, show up to three short
practical effects, and state that saved settings and released operator history
have not changed. Offer **Walk me through what changed (Recommended)**, **Keep
my current settings and continue**, and **View detailed release notes**. The
walkthrough explains every new ability, affected setting, proposed default,
example, consequence, and access or safety boundary before any decision.

After that review choice, when `userPrompt` is non-null, pause write-capable
work for one separate history choice: preview/start (`partial`), defer
(`deferred`), or skip (`declined`). Never run a backfill automatically. When
`userPrompt` is null, explain that the update is prospective and no historical
backfill is needed, record `not-applicable`, and continue. Keep
`releaseNotesPath` available for complete version-by-version detail without
requiring the user to open it to understand the choice.

Record the disposition with
`apply --guidance-backfill <status> --confirm`. A verified completed audit adds
`--audit-verified`. No answer means no new disposition. This acknowledgement
changes only guidance state and grants no history-rewrite, route, access,
deployment, or publication authority.

## Authoring preferences

An optional sidecar records which coding agent, model, and effort should write
release notes: `.simple-changelogs-authoring.json` at the repository root, or
`authoring.json` beside the personal `preferences.json`. Onboarding writes it
(`references/onboarding.md`, "Agents and models"): repository scope writes the
repository file, all-projects scope the personal one, run-only nothing. It is
never a key in the policy or preferences file, whose validators reject unknown
keys, so older copies simply write with the running model. Commit the
repository file with the policy; until then it is ordinary untracked work.

```json
{
  "schemaVersion": 1,
  "roles": { "release-notes": { "harness": "running" } },
  "harnesses": { "<agent id>": { "model": "most-capable", "effort": "xhigh" } }
}
```

One role, `release-notes`, covers all copy this skill writes. Its `harness` is
`running` or an agent id, and a role-level `model` needs an agent id. A
`null` entry means "do not guide this agent". Precedence, highest first: the
current request, the repository sidecar, the personal sidecar, then the
running agent's most capable model at `xhigh`. The role and each agent entry
replace whole; an empty sidecar answers the question and defines nothing.
`inspect` reports `authoring.effective` and each field's layer in
`authoring.source`. `max` effort comes only from an explicit owner choice.

Before writing, resolve the role. `most-capable` means the most capable model
the target agent itself reports; never rank models from memory. Use the
nearest effort the target offers, never above the configured level. Write
directly when the target agent and model are the running ones and the effort
matches or cannot be changed. Otherwise delegate only through a mechanism the
running agent already has, asking before the first launch of another tool in a
session. Keep the requested target and the identity the delegate reports
apart; when they differ, say so in the handoff and sign with the reported
identity. When the target is `unknown` or `null`, the model cannot be
resolved, or nothing can delegate, write with the running model and say which
role was configured, what wrote instead, and why. Signatures name the writer
the runtime reported, never the preference.

The sidecar is a preference, never authority or identity: it grants no
publication, release, or launch permission, stores no credentials, model list,
or launch command, and never joins the effective-policy digest of release
handoffs.
