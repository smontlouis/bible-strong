# Smoke Tests

This is a UI-driven mobile app. Level 1 Ready requires app launch plus representative low-risk product flows to be executed, or explicit user deferral.

## Must Run For Level 1 Ready

### 1. App Launch And Home

- Start the app in a development client.
- Confirm the splash screen clears.
- Confirm the home or onboarding surface renders without an ErrorBoundary fallback.
- Confirm no obvious startup loop occurs around migrations, database opening, Firebase init, or remote config.

### 2. Bible Reading And Navigation

- Open the default Bible tab.
- Navigate to a different book/chapter.
- Open the version selector and return without changing destructive state.
- Confirm the Bible WebView content renders and scrolling works.

### 3. Search To Passage

- Open search.
- Search for a common reference or term.
- Open a result in Bible view.
- Confirm the selected passage displays.

### 4. Safe Local Annotation Flow

- Select a verse.
- Add a highlight or note.
- Confirm it appears in the Bible view.
- Remove the highlight or note created during the test.

### 5. Resource/Download Awareness

- Open Downloads or onboarding resource selection.
- Confirm available Bible/resource rows render.
- Do not delete existing downloaded resources unless the test data was created during this run.

### 6. Zero-Copy Local Resource Service

- Start Postgres and the local resource HTTP service with the complete LSG publication.
- Reinstall the app so its sandbox contains no downloaded resource databases.
- Complete or skip discovery, then choose **Continue/Skip without downloading**.
- Confirm the reader opens LSG from the local HTTP service.
- Open Downloads and confirm LSG is online while its offline copy is not installed.
- Download LSG, confirm the installed state, remove that test copy, and confirm online reading remains available.
- Repeat the zero-copy read and Downloads state check on both iOS and Android.

## Optional Follow-Up

- Strong concordance lookup from a verse.
- Nave or dictionary detail navigation.
- Reading plan list and one plan detail.
- Timeline home and event details.
- Audio/TTS play/pause with no background-mode assertions.
- Theme switch and return to previous theme.
- Import/export backup flow using a throwaway file only.

## Automated Resource Smoke (No UI)

For resource-platform changes, run the deterministic local checks before any device work:

```bash
yarn test src/helpers/__tests__/mobileResourceCatalog-test.ts \
  src/features/resources/__tests__/resourceModel-test.ts \
  src/features/resources/__tests__/strongLexiconAccess-test.ts \
  src/helpers/__tests__/strongLexiconModules-test.ts \
  src/helpers/__tests__/strongLexiconPublications-test.ts \
  --runInBand --watchman=false

RESOURCE_STRONG_LEXICON_BUNDLES_ROOT=/absolute/path/to/strong-lexicon-publications \
  yarn resources:test:lexicon
```

These checks cover the local HTTP contracts, PostgreSQL import/parity, installed-first and
online-first access decisions, and archive integrity. Mobile UI/E2E validation is intentionally
deferred to the product-level smoke owner.

For issue #305, validation is intentionally limited to local function calls, archive checks,
the local PostgreSQL/API stack, and HTTP/artifact smoke scripts. No Argent session or mobile E2E
run is required from the implementation agent; device validation remains with the product-level
smoke owner.

With the local resource API and artifact server running, the repeatable Strong lexicon smoke is:

```bash
yarn resources:smoke:lexicon
```

## Blocked Or Requires Human Context

- Account login, registration, Google Sign-In, Apple Sign-In, and email verification require human-owned credentials.
- Account deletion is destructive and requires explicit user intent.
- Firestore sync validation requires a known test account and clear environment selection.
- Production/staging builds and EAS update behavior are Level 2/release validation unless explicitly in scope.
- Account-backed annotation sync validation requires a known test account and clear environment selection.

## Execution Status

Executed on iOS Simulator with Argent.

Executed:

- Installed `builds/biblestrong.dev.app` on the booted iPhone 17 simulator.
- Started Argent and confirmed the simulator session was available.
- Started Metro under Node 20 on port `8081`.
- Confirmed app launch and Bible reading surface rendered at `Jean 11` / `LSG`.
- Confirmed Bible WebView interaction by selecting verse text and opening contextual search result flow.
- Confirmed search screen rendered existing `jesus` results and opened `Jean 11:35 - LSG`.
- Confirmed Downloads screen rendered resource categories and downloaded counts.
- Opened the main Bible view with the book icon in the tab nav.
- Selected `Genèse 27:2`, added a yellow highlight, confirmed it rendered, then removed it by tapping the selected color again.

Evidence screenshots were captured under `/private/tmp/` during the run:

- `/private/tmp/bible-strong-smoke-10.png`
- `/private/tmp/bible-strong-smoke-search.png`
- `/private/tmp/bible-strong-smoke-search-result.png`
- `/private/tmp/bible-strong-smoke-downloads-2.png`
- `/private/tmp/bible-strong-highlight-created.png`
- `/private/tmp/bible-strong-highlight-removed.png`

### Local resource-service execution — 2026-08-16

Executed against local Postgres 17 and the complete LSG publication revision `lsg-a1edb9406bd74711735b`.

- iOS Simulator, iPhone 17 Pro: fresh reinstall, discovery completed, **Continuer sans télécharger**, Genèse 1 rendered through `http://127.0.0.1:8787`, Downloads reported `0/23` French Bibles and LSG as `Disponible en ligne · Aucune copie hors ligne`.
- iOS lifecycle: downloaded the test LSG copy, observed `Copie hors ligne installée`, removed it through the confirmation dialog, and observed online availability with no offline copy again.
- Android Emulator, Pixel 6 Pro API 36: fresh reinstall, discovery skipped, **Skip downloads**, KJV correctly reported that it was not available online yet, then selecting LSG rendered Genèse 1 through `http://10.0.2.2:8787`.
- Android Downloads reported `92 KB used` and `0/23` French Bibles, confirming the zero-copy state.
- The live coverage endpoint returned the active revision, 66 ordered books, 1,189 chapters, and 31 verses for Genèse 1; the mobile HTTP adapter also verifies this complete coverage in the exhaustive LSG suite.
- Android download/install/remove lifecycle: served the exact validated bundle through the local development artifact server, downloaded LSG to 100%, observed `Offline copy installed`, removed it through the native confirmation dialog, observed `No Offline copy`, and returned to a still-readable Genèse 1 through the local API.
- The local artifact origin was `http://10.0.2.2:8788`; the mobile catalog path, archive SHA-256, content SHA-256, and atomic installation code were unchanged. This proves the lifecycle without relying on production infrastructure or the emulator's external DNS.
- The real-PostgreSQL complete-LSG integration suite now drives the mobile hybrid adapter through installed-local/no-network priority, removal and HTTP fallback, recoverable local corruption, local not-found without source hopping, genuine remote 404, network-offline, and temporary inactive-publication outcomes.
- Automated source-orchestration tests additionally cover unsupported publication, malformed remote content, and remote coverage fallback.
- No hosted database, remote publication upload, Worker deployment, or Cloudflare infrastructure was used.

The exhaustive surface and identity inventory is recorded in [resource-coverage-matrix.md](resource-coverage-matrix.md).
