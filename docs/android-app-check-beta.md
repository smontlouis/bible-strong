# Android App Check beta

This pilot tests native reCAPTCHA Enterprise (also labelled Fraud Defense in Google consoles) while retaining Firebase App Check and the current Resource API contract. See [ADR-0063](./adr/0063-pilot-recaptcha-app-check-on-android.md) and the [provider audit](./research/2026-09-23-app-check-android-provider-audit.md).

## Before a usable beta build

1. In Google Cloud project `bible-strong-app`, create an **Android** reCAPTCHA key for `com.smontlouis.biblestrong`. Keep package verification enabled. Enable support for distribution outside Google Play if official sideloaded APKs are part of the pilot. Do not reuse the web key.
2. Register that key as the additional reCAPTCHA Enterprise App Check provider for Android production, App ID `1:204116128917:android:3ae4e716f079e5a002579c`. Preserve the existing Play Integrity provider. Start with the documented score threshold 0.5 and TTL 1 hour; these are initial test settings, not established acceptance guarantees.
3. Review the shared trust boundary before registration: all backends accepting this App ID can accept its tokens, including the assistant. Registration is not restricted to legitimate beta testers by the build profile.
4. Set `ANDROID_APP_CHECK_RECAPTCHA_SITE_KEY` in the production EAS environment used by the beta build, or in the local build environment. This is the public Android site key, not a secret or a token. Never put a debug token or service-account credential in this value.
5. Check the highest version code already uploaded to Google Play. The beta defaults to `505`; set `ANDROID_APP_CHECK_BETA_VERSION_CODE` to a higher available integer if needed. Keep the subsequent stable build above the beta code if testers should return to stable without uninstalling.

No API enforcement switch needs to be disabled. Provider registration and distribution are separate steps; code presence or a compiled module alone does not make attestation work.

Official setup: [Firebase Android reCAPTCHA provider](https://firebase.google.com/docs/app-check/android/recaptcha-enterprise-provider), [Android key creation](https://docs.cloud.google.com/recaptcha/docs/create-key-mobile).

## Build and distribute

From the repository root, with the Android key available to the build:

```sh
yarn workspace @bible-strong/expo build:android:app-check-beta
```

The script loads the existing production environment and invokes a local EAS Android build using `app-check-beta`. The profile generates an AAB with package `com.smontlouis.biblestrong`, version name `27.0.18-beta.1`, channel `app-check-beta`, and the explicit Android runtime `android-app-check-recaptcha-beta-v1`. It does not submit or publish automatically. Standard Android and Apple builds retain the existing published runtime.

Use the established production upload identity and a Google Play testing track for the same application. Start with internal testing, then the intended closed/open beta once device checks pass. Google Play signs distributed builds with the existing app-signing key. An APK signed only with an upload key or a different local key cannot necessarily replace the Play-installed application.

Have testers join the testing track and update in place. **Do not ask them to uninstall:** that can delete local guest data and installed resources. Leaving a beta track does not downgrade an installed higher version code; a compatible higher stable version is needed.

This provider cannot be installed through JavaScript OTA alone. Do not publish beta JavaScript to the production channel or manually reuse the old native runtime string. The profile is intentionally Android-only; iOS and web do not use this module.

The beta uses an explicitly versioned native compatibility identifier after a local EAS build reported different automatic fingerprints before and during preparation. EAS's runtime equality check remains enabled. Increment the beta runtime identifier before changing its native dependencies, module code, provider configuration or embedded Android site key. A store version-code bump alone does not require changing this identifier.

Check runtime selection through Expo's actual resolver before building:

```sh
yarn workspace @bible-strong/expo exec node --test scripts/__tests__/appCheckRuntime.node-test.cjs
```

## Observe the pilot

Filter Sentry by the beta release and:

```text
diagnostic.event:resource_app_check.token_failed diagnostic.app_check_provider:recaptchaEnterprise
```

Inspect `initialFailure`, `consecutiveFailures`, `retryAfterMs`, native version and OTA update ID. Existing reading HTTP failures use `resource_api.protected_request_failed`; native file downloads use `resource_artifact.http_failed`. Compare with the provider's Google/Firebase assessment metrics for a denominator; Sentry error counts alone do not measure a success rate.

The provider tag identifies native configuration. Firebase may initially return a still-valid token cached by an older Play Integrity build. Validate a real reCAPTCHA acquisition after renewal or through a controlled fresh-token QA request before declaring success. Avoid repeated forced refreshes during normal use.

## Acceptance checks

- Update a currently working Play-installed version to the beta without losing local notes, account access, or installed offline copies.
- Keep an older Play Integrity build functional against the same API after the additional provider is registered.
- On affected physical devices, including Android 9 and a non-rooted Honor, read a remote chapter and install a Bible, lexicon and commentary. Include applicable official sideload distribution and limited Google-services environments.
- Verify a real reCAPTCHA token acquisition, expiry/renewal, reconnection after an offline interval, repeated concurrent reads and a resumed file download. Installed offline resources must still open without connectivity.
- Check account login/sync and the assistant because the default Firebase instance is shared and the beta upgrades its resolved Firebase Android dependencies.
- Confirm requests with missing/invalid tokens remain rejected by the Resource API. Never accept a client-reported platform or provider as authorization.
- Observe latency, score-based refusals, assessment volume and costs before widening distribution.

Local tests/compilation do not substitute for these physical-device checks.

## Build mechanics and maintenance

`withAndroidAppCheckBeta` sets a Gradle property and native manifest metadata. The local module compiles either a standard marker or the reCAPTCHA bridge according to that property; a standard build does not include the reCAPTCHA library. JavaScript reads the native marker and preserves the existing RNFirebase path for standard/older Android binaries, debug builds and Apple platforms.

The beta adds Firebase BoM 34.19.0 to its dependency graph, satisfying the provider's minimum BoM 34.17.0. Inspect the final Gradle runtime graph when changing dependencies. The current reCAPTCHA SDK family has a provider-controlled shutdown schedule, documented in the audit; plan maintained native builds rather than assuming old beta binaries work indefinitely.

To stop rollout, stop admitting new beta testers/releases while retaining the providers needed by installed clients. Removing the reCAPTCHA configuration can strand existing beta installations when tokens renew; switching affected devices back to Play Integrity may restore the original refusal. A security incident may justify that tradeoff, but it is not a transparent rollback.
