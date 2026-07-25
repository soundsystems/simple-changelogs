# Mobile Monorepo Fixture

Monorepo with separate web and mobile audiences. Web already has a reachable
What's New component. Mobile has returning users but no equivalent surface.
When authorized, the canonical mobile path is
`apps/mobile/src/whats-new.tsx`. Store metadata already exists at the Fastlane
and Play paths and may be updated without creating a UI surface.
