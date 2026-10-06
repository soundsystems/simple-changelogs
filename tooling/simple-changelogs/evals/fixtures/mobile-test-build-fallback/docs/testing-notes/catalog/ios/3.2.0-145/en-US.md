# What to Test: iOS 3.2.0 build 145

Application: com.example.catalog; locale: en-US; group: internal QA.
Artifact: iOS Simulator build 3.2.0 (145), not uploaded.
Source commit: 0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6
Status: prepared locally; checks ran on the iOS Simulator only.

## Full checklist

Open Catalog, rapidly select and remove Filters, then use Clear all.
Expect the latest selection and no active filters after clearing.
Simulator result: passed. Physical-device behavior remains unverified.

## TestFlight copy

Not applicable: this simulator build cannot be uploaded to TestFlight.
