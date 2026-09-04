# ADR-0039: Name the public site and Expo app explicitly

- Status: Accepted
- Date: 2026-09-04

## Context

The workspace formerly called `apps/mobile` now produces iOS, Android, and Expo Web runtimes. Its
name therefore implied a platform restriction that no longer exists. The workspace formerly called
`apps/web` is a distinct TanStack Start application for the public website and shared study routes,
so “web” no longer distinguished it from the Expo app's browser runtime.

Calling the multiplatform workspace `apps/app` would be redundant inside `apps/`, while naming both
browser-capable products with “web” would keep commands and deployment ownership ambiguous.

## Decision

Rename the deployable workspaces as follows:

- `apps/mobile` and `@bible-strong/mobile` become `apps/expo` and `@bible-strong/expo`.
- `apps/web` and `@bible-strong/web` become `apps/site` and `@bible-strong/site`.

Root development commands use `dev:expo` and `dev:site`. Platform-specific Expo commands use the
`dev:expo:<platform>` form. Product and domain documentation calls the Expo-owned context the
**Study workspace** and the TanStack Start-owned context the **Public site**; these durable roles do
not inherit the implementation-oriented directory names.

## Consequences

- Paths, workspace locators, CI configuration, architecture checks, and documentation must use the
  new names together.
- `site` unambiguously means the public TanStack Start deployment.
- `expo` unambiguously means the multiplatform application and may be qualified as iOS, Android, or
  Web where needed.
- A future migration away from Expo would require another workspace rename, but current developer
  commands remain immediately discoverable and avoid the inaccurate `mobile` label.
