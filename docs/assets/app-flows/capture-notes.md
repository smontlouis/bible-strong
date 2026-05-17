# App Flow Capture Notes

Device: iPhone 17 simulator (`67D95AA7-A03F-4DFF-A2AF-80E313FCC864`)
App: `com.smontlouis.biblestrong.dev`
Date: 2026-05-16, continued 2026-05-17

## Captured Screens

The canonical screenshot inventory is stored in `docs/assets/app-flows/data/screenshots.json`. Optimized, versioned WebP images are stored in `docs/assets/app-flows/screenshots/`.

The original PNG captures were produced under `.scratch/argent-feature-map/` and are local working artifacts, not durable documentation.

## Pruned Screens

The visual map excludes obsolete or non-informative captures where an embedded WebView/DOM was blank, offline, or in a transient error state and a better functional capture now exists. These are recorded in the `pruned` section of `docs/assets/app-flows/data/screenshots.json`.

Removed categories:

- study editor blank/offline DOM states replaced by the rich editor captures;
- verse note offline/network-error states replaced by the working verse-note editor captures;
- chronology/timeline blank states replaced by rendered timeline captures;
- direct Lexique empty/loading state replaced by the working Strong lexical flow;
- pericope/word-annotation WebView offline error states;
- non-informative blank external App Store handoff.

## Observed Limitations

- The device/app was offline for part of the capture run, so some useful product states remain represented as required-download or offline-capable views. Non-informative blank/error captures were pruned from the visual map.
- `debugger-component-tree` could not connect to Metro on port `8081`; navigation used Argent `describe`, screenshots, and normalized tap coordinates.
- Export was triggered to capture the native share sheet; this updated the latest backup/export timestamp in the simulator account state.
- During verse-action exploration, selected verses were visibly associated with existing tag/highlight state while capturing tag and study paths.
- Nave, cross-references, Strong lexicon, Westphal dictionary, and BHS were downloaded during capture, changing the simulator's local resource state.
- Commentaries were also downloaded and captured while exploring resource states, but this resource is explicitly not required for the goal.
- The History clear button executed immediately during capture and changed the simulator history state to empty.
- External community/store links were tested only to the visible handoff state when they left the app. Non-informative blank handoffs were pruned.
- Pericope and word-annotations dedicated screens were reached via the app's registered deep link route after no visible menu entry was found in the current seeded UI.
- Support, Nave warning, compare-version selector, forgot-password, local-search, and my-plan-list were also reached by registered deep link routes where the visible seeded UI did not provide a reliable direct entrypoint.
- Login/register were not captured in a logged-out state because the simulator account is already authenticated; opening `login` redirects/no-ops back to the current authenticated stack, and the app state was not reset.
- Pericope and word-annotation item taps that only landed on a WebView offline error state were pruned from the visual map.
- After the Strong lexicon download, the direct Lexique entrypoint still presented an empty/loading state during one pass; that capture was pruned, while the working Strong lexical flow from LSGS remains indexed.
- The app displayed a persistent React key warning overlay during some captures; it was dismissed before the later Strong captures.
- The selected verse Study commentaries panel was captured as an installed study feature; this is separate from the downloadable commentaries resource flow, which remains out of scope per user clarification.
- The new-tab selector and reference selector were captured on 2026-05-17. Opening the Commentary option created a commentary tab backed by installed commentary data; this is distinct from the out-of-scope downloadable commentaries resource.
- The dedicated commentary route, header action menu, and next-verse navigation were captured. The commentary header open-in-new-tab action was not triggered to avoid adding another tab.
- The Timeline route initially showed blank/offline content in earlier captures. Those captures were pruned after a later pass rendered the timeline, downloaded the chronology module from a timeline event, and captured section, search, event-detail, and related-event flows.
- Timeline home was recaptured after chronology assets became available, including rendered period cards, FAQ expansion, next-section navigation, and a second section's event lanes.
- Onboarding, app-rating prompts, feature onboarding, and logged-out login/register flows were not captured because they require account reset, install-time state, or trigger conditions that were not forced in this run.
- Plan reset/stop confirmations and study rename were captured but cancelled or left unsaved; no destructive plan or study action was confirmed.
- A real reading-plan slice share sheet was captured from the active Lire les écritures plan and dismissed without choosing a destination.
- The study item settings sheet was captured. The tag-edit option did not reliably open from the current AX target pass, so the broader studies tag filter sheet was captured instead.
- Tag rename and new-tag modals were captured and dismissed without saving. Tag deletion confirmation was captured and cancelled.
- The tag action "Créer un groupe d'onglets" was executed to capture the result; this changed the simulator tab state by creating a two-tab group for the selected tag.
- Existing bookmark edit and delete-confirmation flows were captured; bookmark deletion was cancelled.
- Download manager select-mode, batch delete, single delete, and default-version redownload confirmations were captured; all destructive or download-triggering confirmations were cancelled.
- Dedicated link list/detail/edit/tag flows were captured; the link edit form was dismissed without saving. A delete action was visible in link menus but no link deletion was confirmed.
- Default Bible settings list was captured without changing the selected default version. Automatic backup restore confirmation was captured and cancelled; automatic backup export was triggered to capture the native share sheet and success toast.
- Highlight and word annotation action sheets, tag editing sheets, and delete confirmations were captured; all deletion confirmations were cancelled and no tag/color changes were selected.
- The verse note editor was captured from a selected verse after opening the Annoter tab's Note action. The attached verse context was expanded; no text was entered and no save action was triggered.
- Selected-verse share actions were captured. Copy wrote the selected verse text to the simulator clipboard, and the native share sheet was dismissed without choosing a destination.
- Profile unverified-email state and verification reminder sheet were captured; the resend email action was not triggered.
- The dev-only Nuke app reset confirmation was captured from More and cancelled; no reset was performed.
- Note deletion confirmation was captured from the Notes screen and cancelled; no note was deleted.
- Regular note and annotation note detail/edit/share/tag-edit flows were captured. Edits were cancelled and no note content or tags were changed.
- The dedicated compare-version toggle settings route was captured without changing any switches.
- The regular note detail "Ouvrir dans un nouvel onglet" action was triggered; it returned visibly to the Notes list, so no separate result state was indexed.
- After the study WebView/DOM issue was fixed, the rich study editor content, toolbar, style menu, and extended formatting menu were captured from an existing study. Earlier blank editor captures were pruned. No text was entered and no save action was triggered.
- The Studies plus button was tapped to capture new-study creation; it created a new untitled study in the simulator state.
- The study publish action was visible but disabled for the untitled study, so no publish flow was triggered.
- Study deletion confirmation was captured from the editor actions menu and cancelled; no study was deleted.
- The study "Ouvrir dans un nouvel onglet" action was triggered and captured in the Bible reader with its result toast; this changed the simulator tab/navigation state.
- Home verse-of-the-day image, notification, and native share subflows were captured from the offline Home state without changing the notification switch or selected time.
- Additional lower Home sections were captured, including daily Greek/Hebrew lexicon entrypoints and external Audibible/Facebook handoffs. Facebook cookie consent was not accepted.
- Home Plans & Meditations list, FR/EN explorer variants, and a meditation-book detail sheet were captured. The "Démarrer ce plan" action was not triggered to avoid adding a new active plan.
- The active meditation plan timeline and one meditation reading content screen were captured. The reading was not marked complete, and the reading overflow menu did not reliably open from the current AX target pass.
- Support Tipeee and PayPal external handoffs were captured in Safari; cookie consent and payment/account actions were not accepted or triggered.
- App switcher tab group actions, group list, edit form, and new-group form were captured. Close-all/delete actions were not triggered, and edit/new-group forms were dismissed without saving.
- Direct route captures for Bible verse notes, Bible verse links, compare-verses, and concordance-by-book were added using app deep links and stable parameters. Compare-version checkboxes were not changed, and open-in-new-tab was not triggered from the compare menu.
- Nave and Lexique resource language popovers were captured without toggling the language. Strong detail action and tag sheets were captured without sharing, opening a new tab, or changing tags.
- Reader color palette and custom color creation/editing forms were captured. No color was added, updated, reset, or deleted.
- Reader verse labels and cross-version annotation sheets were captured from WebView annotation chips. Tiny inline cross-version actions did not reliably activate through the current AX/WebView target pass, so version switching and new-tab actions were not triggered from that sheet.
- The chronology module was downloaded from the timeline event-detail requirement state, changing the simulator's local timeline resource state.
- Opening the Noah timeline event produced a transient duplicate-key warning toast; it was dismissed and not indexed as a user-facing feature flow.
- Opening `biblestrong:///notes` showed an Expo Router unmatched-route screen, so it was not indexed as an app feature capture.
- This is a broader capture of top-level and readily reachable flows, not yet a full exhaustive state map.

## Follow-Up Capture Targets

- Download success/progress states for remaining large resources, excluding downloadable commentaries.
- Online Bible reader states for pericope/word-annotation navigation once the embedded reader is reachable.
