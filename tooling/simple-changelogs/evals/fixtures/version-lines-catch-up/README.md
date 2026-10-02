# Trailhead

Web and Mobile ship on separate trains that share one public version line.

- Mobile releases are tagged `mobile-v*` and submitted by
  `.github/workflows/release-mobile.yml`.
- Web releases are tagged `web-v*` and deployed by
  `.github/workflows/release-web.yml`.
- `.simple-changelogs.json` records a `catch-up` line for the `web` and
  `mobile` trains.

The mobile public version lives in `apps/mobile/app.json` at `expo.version`,
and its history is the root `CHANGELOG.md`. The web public version lives in
`apps/web/package.json`, and its history is `apps/web/CHANGELOG.md`. Web
already shipped `1.0.0`; Mobile is still on `0.21.3` with pending fixes. The
iOS build number and Android version code are submission counters, not public
versions.
