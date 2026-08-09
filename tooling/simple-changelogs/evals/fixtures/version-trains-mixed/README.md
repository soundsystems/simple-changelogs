# Trailhead

Release groups in this repository:

- **Mobile train:** iOS and Android share one public version, `expo.version` in
  `apps/mobile/app.json`. Both platforms submit from the same
  `mobile-v*` tag, so a mobile release always advances both stores together.
- **Web train:** `apps/web/package.json` owns its own public version and
  releases from `web-v*` on its own schedule.

`.simple-changelogs.json` records `crossSurfaceVersioning: mixed` because those
two groups differ. Build numbers and version codes stay submission counters.
