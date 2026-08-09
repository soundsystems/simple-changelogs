# Trailhead

Mobile and Web ship on separate trains.

- Mobile releases are tagged `mobile-v*` and submitted by
  `.github/workflows/release-mobile.yml`.
- Web releases are tagged `web-v*` and deployed by
  `.github/workflows/release-web.yml`.
- `.simple-changelogs.json` records `crossSurfaceVersioning: independent`.

The mobile public version lives in `apps/mobile/app.json` at `expo.version`.
The iOS build number and Android version code are submission counters, not
public versions. `apps/mobile/package.json` carries the development version.
