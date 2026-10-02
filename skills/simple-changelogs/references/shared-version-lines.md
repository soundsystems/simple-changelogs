# Shared Version Lines

- **No line** (`sharedVersionLines` absent or `[]`): each release train
  numbers itself.
- **`catch-up`**: a member behind the line's highest number ships exactly that
  number; any other release takes the next number.
- **`bump-shared`**: every release takes the next number above the line's
  highest; members that did not ship skip it.
- Apply the mode silently. Mention it only for a catch-up jump or a skip, in
  one sentence such as "Mobile ships as 1.0 to match Web."

## Contents

- Policy
- Selecting a number
- Examples
- Wording, approval, and verification
- Owner question

## Policy

A line is `{ "mode": "catch-up", "trains": ["web", "ios", "android"] }`.
Trains are `releaseTrain` ids with one version owner each; an unresolved or
ambiguous owner blocks with `version-owner-ambiguous`. A line has 2+ unique
trains, a train joins at most one line, and lines never affect each other or
outside trains. Trains that `crossSurfaceVersioning` makes one train, or whose
releases carry no numbered version (date-only headings), never join a line.
The full-only policy sets numbers only: no release, store, deployment, or
history-rewrite authority, no build numbers, and no desktop release-note
destinations.

## Selecting a number

At the input target revision, read each member's latest stable public version
from its canonical owner. Order dotted numeric versions of one to three parts,
zero-padded (`1.2` equals `1.2.0`), ignoring `+build`; exclude prereleases, and
block on a version with non-numeric parts. Report one evidence item,
`versionLine ` plus compact JSON with exactly these keys (the future
`versionDecision.versionLine`):

- `mode`, and `members`: the line's trains, sorted;
- `memberVersions`: each member's version, or `null` before its first stable
  release;
- `sharedVersion` (`H`): the highest non-null member version, or `null`;
- `sharedVersionTrains`: the members holding `H`, empty when `H` is `null`;
- `outcome`: `catch-up` or `advance`.

A release set may span any subset of a line, and every train in it selects the
same number. `L` is a train's own impact after the repository's `0.x` mapping,
and `next(v, L)` is the next version after `v` at `L`.

1. A train without target-contained changes never ships just to match.
2. `catch-up`: when every shipping train is `null` or behind `H` and its own
   `next(P, L)` is at most `H`, each ships exactly `H` (`catch-up`).
   Otherwise all ship `next(H, L)` at the set's highest `L` (`advance`).
3. `bump-shared`: every release ships that `next(H, L)` (`advance`). Trains
   that did not ship skip it with no placeholder or receipt.
4. With `H` null, choose the first number normally (`advance`).
5. Every number exceeds the train's own version. `catch-up` selects exactly
   `H`; `advance` selects above `H`, or `H` is null.

Receipts keep their schema: `releaseImpact` is the train's own impact, the
bump level is the jump from its own version, and evidence carries, for
example, `versionLine {"members":["mobile","web"],"memberVersions":{"mobile":"0.21.3","web":"1.0.0"},"mode":"catch-up","outcome":"catch-up","sharedVersion":"1.0.0","sharedVersionTrains":["web"]}`.

## Examples

**Web reaches 1.0.** Web ships `1.0.0` while Mobile is at `0.21.3`. Mobile's
next release ships `1.0.0`, even when its own changes are patch-level. If Web
ships `1.1.0` first, Mobile catches up to `1.1.0` and skips `1.0.0`.

<!-- shared-version-line-examples -->
| Mode | Before | Ships | Selected | Outcome |
| --- | --- | --- | --- | --- |
| catch-up | web 0.21.1, mobile 0.21.0 | mobile patch | 0.21.1 | catch-up |
| catch-up | web 0.21.1, mobile 0.21.0 | mobile minor | 0.22.0 | advance |
| catch-up | web 0.21.1, mobile 0.21.0 | web patch, mobile patch | 0.21.2 | advance |
| catch-up | web 1.0.0, mobile 0.21.3 | mobile patch | 1.0.0 | catch-up |
| catch-up | web 1.1.0, mobile 0.21.3 | mobile patch | 1.1.0 | catch-up |
| catch-up | web 1.1.0, ios 1.0.0, android - | ios patch, android minor | 1.1.0 | catch-up |
| catch-up | web 0.21.1, mobile 0.21.0 | mobile none | - | - |
| bump-shared | web 0.21.1, mobile 0.21.0 | mobile patch | 0.21.2 | advance |
| bump-shared | web 0.21.1, ios 0.21.0, android 0.21.0 | ios minor, android patch | 0.22.0 | advance |

## Wording, approval, and verification

- Wording follows the train's own impact, not the number: a patch-impact
  catch-up keeps one flat **Bug Fixes & Improvements** section, and reaching
  `1.0.0` or a major only by catching up gets no major synthesis, name, or
  launch copy.
- `publicVersioning` keys on the jump from the train's own version, and a
  number crossing a major boundary, `0.x` to `1.0.0` included, always asks.
- Validate exact direction; never coerce it. It must exceed the train's own
  version and be at least `H`; under `bump-shared` it must exceed `H` unless
  it is its release set's number. Otherwise block with
  `invalid-version-direction` and `choose-version`, name the mode's number in
  evidence, and change nothing.
- Each train keeps its own notes and scope map; equal numbers never mean equal
  contents. A catch-up gets its own section, never appended to another train's
  released one; in a shared `CHANGELOG.md`, use the repository's
  train-qualified headings, or ask before adding them.
- A Web deploy whose only new target changes belong to another member's
  reconciled release keeps Web's number.
- Under `bump-shared`, verify that no other member's released section carries
  the selected number unless both are in one release set; a collision returns
  `final-verification-failed` and `review-finalization`.
- Adopting a line aligns forward from `H`; renumbering released history needs
  explicit owner direction under `references/backfill.md`.

## Owner question

Inspection lists version owners in `inventory.versionTrains` and the
`shared-version-lines` question when 2+ have no recorded answer. Skip it when
evidence shows one train. Never ask the owner to name trains: prefill one line
with every detected train, and ask about membership only when 3+ are detected
and evidence suggests some should stay separate. Ask once, **Should your apps
share version numbers? Choose one:**

1. **Separate numbers per app** — Each app counts its own releases, the most
   common choice. Save `[]`.
2. **Same number everywhere** — An app that is behind catches up: Web ships
   1.0, so the next Mobile release is 1.0. Save a `catch-up` line.
3. **One shared counter** — Every release gets the next number, and apps that
   did not ship skip it. Save a `bump-shared` line.

Mark option 2 **Recommended** when detected versions already match or the
owner asked to keep them in sync, otherwise option 1, with a one-clause reason.
Record it with `--shared-version-lines '<json>'`.
