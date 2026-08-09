# Trailhead

One release train covers Mobile and Web.

- `release/canonical-version.json` is the single canonical release version.
- `scripts/apply-canonical-version.mjs` writes that value into
  `apps/mobile/app.json` and `apps/web/package.json`.
- One tag `v*` runs `.github/workflows/release-all.yml`, which submits mobile
  and deploys web together.
- `.simple-changelogs.json` records `crossSurfaceVersioning: shared`.

The iOS build number and Android version code remain submission counters and are
not part of the shared public version.
