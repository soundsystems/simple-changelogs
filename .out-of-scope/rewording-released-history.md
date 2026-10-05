# Released history is not reworded to match newer guidance

Simple Changelogs does not rewrite released changelog entries merely because newer guidance would word them differently, including style passes over old releases.

## Why this is out of scope

Released entries are a record readers have already seen, and other tools verify releases against them. Rewording them changes history without changing anything that shipped. Guidance updates change how new entries are written, and each update notice states that released history is unchanged.

## What to use instead

- An approved historical audit under `references/backfill.md` covers real errors and meaning-changing corrections.
- A guidance update may offer an optional, user-approved audit when it names one.

## Decided in

The Non-Negotiable Boundaries of every distribution's `SKILL.md`, introduced in `7a5cac8a` ("Make changelog policy repo-local").
