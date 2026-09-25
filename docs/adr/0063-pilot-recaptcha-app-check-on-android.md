# ADR-0063: Pilot reCAPTCHA App Check in an Android beta

- Status: Accepted for the beta pilot; production generalization remains unvalidated.
- Date: 2026-09-23

## Context

Some Android users cannot obtain a Play Integrity App Check token, preventing both online resource reads and offline-copy downloads. New diagnostics preserve the initial 403 refusal behind subsequent throttling errors. The [access audit](../research/2026-09-23-resource-api-access-audit.md) recommends testing another provider before introducing a separate API authorization protocol.

## Decision

Prepare a Play Store beta build of the existing Android package using Firebase's native reCAPTCHA App Check provider. Keep the existing Firebase project, App ID, API URLs, header, and server verification. Existing published clients retain their Play Integrity configuration. This decision does not authorize removing App Check, relaxing its acceptance rules, or replacing user authentication.

The `app-check-beta` EAS profile uses a dedicated update channel and a higher Android version code. Its Android runtime is explicitly versioned as `android-app-check-recaptcha-beta-v1`; standard Android and Apple retain the existing published runtime. The beta runtime must be incremented when its native code, dependencies or provider configuration change. A beta is installed as an update of the production package so local data is retained when distributed using the same Play signing identity; testers must not uninstall the app to switch tracks.

On 2026-09-25, the initial fingerprint policy blocked a local EAS build because the runtime computed on the development machine differed from the runtime computed during build preparation. Controlled comparisons of a relocated archive, a fresh dependency installation and prebuild did not isolate the differing input from that failed run. For this bounded pilot, retain the existing manual runtime policy and give the new native variant its own identifier instead of migrating all Android releases to automatic fingerprinting. The EAS equality check is retained; this does not claim to repair automatic fingerprinting generally.

Select the provider in native build configuration, not in JavaScript or a remotely mutable flag. A small Android-only local Expo module bridges the official Firebase SDK. Its standard build exposes only the standard provider marker and adds no reCAPTCHA dependencies. Its beta build includes Firebase BoM 34.19.0 and `firebase-appcheck-recaptcha`. The Android site key is public configuration embedded in the native manifest. A missing key fails the beta build configuration.

The beta installs the reCAPTCHA provider directly on the default native Firebase App Check instance before requesting tokens. It must not subsequently call RNFirebase's provider initializer, which would overwrite the selected factory with Play Integrity. The Firebase SDK continues to own token persistence, refresh and native retries; existing shared acquisition and cooldown logic is retained in JavaScript. Development uses the debug provider; Apple uses its existing provider. No automatic cross-provider fallback is introduced.

Failures carry `appCheckProvider` and the Sentry tag `diagnostic.app_check_provider`. This describes the selected provider, not a verified claim inside the token: a valid token persisted from an earlier build may be reused until the SDK refreshes it.

## Consequences

The API contract does not require migration for this pilot. Enabling the new provider for the production App ID nevertheless expands its token issuance paths for every backend trusting that App ID, including the separately hosted assistant. A beta cohort is a rollout control, not a security boundary. Firebase registration is an explicit operational step, distinct from this code change, and must preserve Play Integrity for older clients.

The native provider is in preview, requires Android-key configuration for off-Play distribution when applicable, and may still reject devices based on risk score. Costs, SDK sunset dates, and actual device acceptance must be validated before generalization. The [beta runbook](../android-app-check-beta.md) defines setup and acceptance checks. Successful local compilation does not demonstrate successful reCAPTCHA attestation.

No data migration, installation reset, resource deletion, new API session type, or server-side weakening is part of this pilot.
