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

## Tab Group Synchronization Across Sessions

Use the same development account in two independent browser sessions (or a browser
and a native development client). Use disposable tabs and groups.

- Open a tab in session A. As soon as it appears in B, close it in B. Confirm it
  disappears in A. Repeat in both directions, including acting immediately after
  observing the preceding change.
- Open and close tabs rapidly in two different groups. After one second without
  local changes plus network latency, both sessions should show the final tab lists.
- With network throttling enabled, make another change while the preceding write
  is still pending. Confirm the final state propagates once that write completes.
- Drag a group above or below another group. Confirm the other session adopts
  that order and keeps it after reloading. New groups should appear at the end.
- Edit a group and delete that group before the debounce expires. Confirm it does
  not reappear. Selecting an active tab remains local to each session.

The outgoing debounce remains 1000 ms. Received snapshots update the comparison
baseline synchronously; there is no cooldown that discards user actions. Pending
and in-flight local changes are retained per group, and failed or interrupted work
is handed to the existing account-scoped Firestore retry outbox. This does not add
field-level conflict resolution for concurrent edits to the same group.

Automated regression coverage lives in
`apps/expo/src/state/__tests__/useTabGroupsSync-test.tsx`; run it with
`yarn workspace @bible-strong/expo test useTabGroupsSync-test --watchman=false --runInBand`.
These tests simulate Firestore callbacks and delayed writes; they do not replace
the two-session smoke above.

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

## BHG And Its Interlinear Indexes Follow The Catalog — before releasing 27.2

ADR-0079 removes every published revision from the application: `BHG`, its two interlinear
indexes and the Strong indexes are resolved from the catalog and matched by the metadata of the
files. Automated tests cover the resolution, the pairing rules and the 27.1.1 catalog validator.
The steps below cover what only a device shows: real archives, SQLite, the download queue and the
reader. Use disposable installs; run them on iOS and on Android.

Vocabulary: *interlinear mode* is the BHG display mode « Interlinéaire »; *the pair* is the BHG
text and one index. To inspect what is installed on an iOS Simulator:

```bash
DATA="$(xcrun simctl get_app_container booted com.smontlouis.biblestrong.dev data)"
sqlite3 "$DATA/Documents/SQLite/bibles.sqlite" \
  "SELECT text_revision, schema_version, substr(resource_generation,1,12) FROM versions_meta WHERE version='BHG'"
sqlite3 "$DATA/Documents/SQLite/shared/interlinear-bibles/bible-bhg-interlinear-fr.sqlite" \
  "SELECT key, value FROM ResourceMetadata WHERE key IN ('textRevision','schemaVersion','indexRevision')"
```

Today both must read `bhg-803c482ed06005693547`.

### A. Fresh install against production

1. Install the 27.2 build on a device without Bible Strong. Skip every download.
2. Open BHG, Genesis 1, then Matthew 1. Switch to interlinear mode in French, then English:
   words, glosses and transliteration render (read online).
3. Open the BHG lexicon from a verse and a Strong concordance from a BHG word: both list verses.
4. Downloads → download BHG. Expected: installed, no « mise à jour disponible ».
5. Interlinear mode → download the French index. Expected: the queue shows the index only (BHG is
   already the catalog one); the mode turns on by itself when the download ends.
6. Airplane mode. Reopen the app. Genesis 1 and Matthew 1 still read in interlinear mode; English
   gloss reports that it needs a connection or a download, and never shows French glosses instead.
7. Still offline, open LSG in Strong mode and in reverse interlinear (LSG and its Strong index
   installed beforehand): Strong numbers and original words render. This is the Strong index gate
   that no longer names a BHG revision.
8. Back online: delete the French index only → BHG stays installed and readable; delete BHG → both
   indexes go with it.

### B. Upgrade from 27.1.1 with BHG and an index installed

1. Install 27.1.1 from the App Store (or a build of commit `f2f5f543e`). Download BHG and the
   French index, read Genesis 1 in interlinear mode, add a highlight on a BHG verse in simple mode.
2. Go offline. Install the 27.2 build over it (same bundle identifier, no uninstall).
3. Launch offline. Expected: no migration error; Genesis 1 reads in interlinear mode from the
   installed pair; the highlight is still there; Downloads shows BHG and the index installed.
4. Back online, relaunch. Expected: no update offered for BHG or the index (the catalog still
   publishes the installed archives) and no re-download starts.
5. Repeat step 1 with LSG and its Strong index installed and check Strong mode offline after the
   upgrade.

### C. A new BHG appears in the catalog — local simulation, nothing published

The rebuilt BHG and indexes wait under
`apps/resource-studio/outputs/releases/*2026-10-08*bracketed-references`. This scenario serves them
from the development machine. It changes the catalog **in the working tree only**: do not commit
it, and restore it at the end.

Prepare, from the repository root:

```bash
REL="$PWD/apps/resource-studio/outputs/releases"
BHG_ROOTS="$REL/ordinary-bible-publications-2026-10-08-bhg-bracketed-references:$REL/interlinear-bible-publications-2026-10-08-bracketed-references"

# 1. With the committed catalog, install the published pair first (scenario A, steps 4-5).

# 2. Publish the rebuilt BHG in the working-tree catalog only.
MOBILE_CATALOG_GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  yarn workspace @bible-strong/resource-studio resources:publication:r2 catalog-patch \
  --bundles "$REL/ordinary-bible-publications-2026-10-08-bhg-bracketed-references" \
  --bundles "$REL/interlinear-bible-publications-2026-10-08-bracketed-references"
git diff --stat packages/resource-catalog   # three entries, textRevision bhg-e15bd9f0f1a91140579c

# 3. Local Resource service: Online access on :8787, Offline-copy archives on :8788.
yarn resources:db:up && yarn resources:migrate
RESOURCE_PUBLICATION_ROOTS="$BHG_ROOTS" yarn dev:resources
RESOURCE_PUBLICATION_ROOTS="$BHG_ROOTS" yarn workspace @bible-strong/resource-service serve:artifacts
```

Start Metro with `EXPO_PUBLIC_RESOURCE_API_URL` and `EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL`
pointing at ports 8787 and 8788 of the development machine (`127.0.0.1` on an iOS Simulator,
`10.0.2.2` on an Android Emulator, the LAN address on a device; see `validation.md`). The
application now holds a catalog newer than its installed files; the production catalog it fetches
is older and is ignored. Other Bibles are not served by this local service: test BHG only.

1. Launch **offline** first. Expected: Genesis 1 and John 7 read in interlinear mode from the
   installed pair, unchanged. John 7:53 does not exist yet.
2. Online. Downloads and the version selector flag BHG and its French index as « mise à jour
   disponible ». The English index, not installed, shows no update.
3. Leave the pair alone and switch the gloss language to English (read online). Expected: the
   chapter still reads correctly — the text is now the published one, read online with the tokens.
   Check Matthew 15:6, Acts 2:11 and Romans 1:10 — three of the twenty-one verses whose words
   moved because the rebuilt text gains a word at their start — and Philippians 1:16-17, which
   are new: every gloss sits under its own word.
4. Update **the index only** (tap its update). Expected: the queue shows BHG first, then the index,
   and both finish. Interlinear mode reads John 7:53, Romans 16:25-27, Matthew 15:6 and Acts 2:11
   with glosses under the right words. The inspection commands read `bhg-e15bd9f0f1a91140579c`
   twice.
5. Reinstall the published pair (restore the catalog, relaunch, reinstall, patch again) and this
   time update **BHG only**. Expected: the queue adds the installed French index by itself.
6. Interrupt the pair: start the BHG update, and kill the application as soon as BHG is installed
   and before the index ends. Relaunch **offline**. Expected: BHG reads in simple mode; interlinear
   mode shows its unavailable state with a download action, never misplaced glosses. Back online
   the mode reads again and the index update is still offered.
7. Airplane mode after both are updated: the new pair reads offline.

Variant for the guard alone, without the local Online service: keep
`EXPO_PUBLIC_RESOURCE_API_URL` on production and point only the artifact base URL at :8788. After
updating BHG alone and killing the app before the index ends, the installed text is the rebuilt
one while production still serves tokens for the published one: interlinear mode must read
Matthew 15:6 and Acts 2:11 correctly (published text and tokens, both online), not the rebuilt
text with published tokens.

Restore: `git checkout -- packages/resource-catalog/src/mobile-resource-catalog.json`, stop both
services, delete the test installs.

### D. 27.1.1 at the time BHG is published — only if the canonical recipe is chosen

Serve the rebuilt bundles as in C to a **27.1.1 development build**, with a BHG bundle whose
Offline copy is the canonical JSON under the entry name `bible-step.json`.

1. With the published pair installed, update BHG. Expected: the install succeeds; simple mode
   reads; interlinear mode reads online (connection required) with glosses under the right words;
   offline it reports an invalid Offline copy instead of rendering.
2. Update the index. Expected: the download fails validation three times and the previous index
   file is kept. This is the known, accepted outcome on 27.1.1.

### What these steps do not prove

- The published index archives on R2 were not opened: their text declaration in the catalog comes
  from the constants 27.1.1 pins and from the live `/v1/interlinear-bibles/BHG/languages/*/coverage`
  responses.
- Nothing was run on a device when this plan was written; record the results below.
