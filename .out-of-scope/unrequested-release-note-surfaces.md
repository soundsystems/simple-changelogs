# No new release-note surfaces without authorization

Simple Changelogs does not create or wire a new release-note modal, route, screen, page, navigation entry, dismissal store, or internal operator surface on its own initiative.

## Why this is out of scope

A new surface is a product decision with its own design, access, and maintenance cost. Updating an existing, documented destination is ordinary sync work; inventing a new one is not.

## What to use instead

- A one-off explicit request authorizes one new destination without changing the ongoing preference.
- The `newReleaseNoteSurfaces` policy records a standing answer (`ask`, `existing-only`, or a grant).

## Decided in

The Non-Negotiable Boundaries of every distribution's `SKILL.md`, introduced in `7a5cac8a` ("Make changelog policy repo-local").
