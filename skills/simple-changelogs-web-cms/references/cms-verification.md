# Verification

Run the bundled validator from the installed skill directory:

```bash
bun scripts/validate-cms.ts /absolute/path/to/repository
```

Then verify:

- policy and `CMS_CHANGELOG.json` parse with the bundled schema;
- entry IDs are unique, dates are valid, and entries are newest-first;
- the configured route matches the implemented authenticated route;
- unauthenticated requests are redirected, rejected, or shown the established
  login surface;
- the CMS navigation reaches the changelog for authorized operators;
- representative CMS workflow outcomes render while general web, mobile-only,
  store, package, and developer-only outcomes from the same release remain
  absent;
- an initial backfill reaches the oldest trustworthy evidence, covers every
  intervening range through setup, accounts for intentional omissions, and
  leaves incomplete evidence gaps resumable instead of recording `completed`;
- no public route, API, sitemap, feed, or customer update surface exposes it;
- `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` were not created or edited by
  this workflow;
- repository tests, type checks, Biome/Ultracite checks, and builds required by
  local policy pass.

Inspect the final diff after formatting. Report unavailable credentials or
provider checks precisely; do not call an unrun access test passed.
