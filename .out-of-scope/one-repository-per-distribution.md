# Distributions are not split into separate repositories

The six changelog distributions and `publish-skill` live in one repository. Requests to give each distribution its own repository are out of scope while they share ownership, versioning, and release cadence.

## Why this is out of scope

The Skills CLI installs one self-contained skill directory, so a shared repository costs installers nothing. Keeping the distributions together lets one check verify byte-synced helpers, pinned protocol schemas, and guidance versions across all of them in a single change.

## When to revisit

Split a distribution out once it needs independent ownership, versioning, or release cadence.

## Decided in

The README's distribution guide, introduced in `042e36c3` ("Expand release destination guidance").
