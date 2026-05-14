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

## Optional Follow-Up

- Strong concordance lookup from a verse.
- Nave or dictionary detail navigation.
- Reading plan list and one plan detail.
- Timeline home and event details.
- Audio/TTS play/pause with no background-mode assertions.
- Theme switch and return to previous theme.
- Import/export backup flow using a throwaway file only.

## Blocked Or Requires Human Context

- Account login, registration, Google Sign-In, Apple Sign-In, and email verification require human-owned credentials.
- Account deletion is destructive and requires explicit user intent.
- Firestore sync validation requires a known test account and clear environment selection.
- Production/staging builds and EAS update behavior are Level 2/release validation unless explicitly in scope.
- Account-backed annotation sync validation requires a known test account and clear environment selection.

## Execution Status

Executed on iOS Simulator with `serve-sim`.

Executed:

- Installed `builds/biblestrong.dev.app` on the booted iPhone 17 simulator.
- Started `serve-sim` and confirmed the simulator stream at `http://127.0.0.1:3101`.
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
