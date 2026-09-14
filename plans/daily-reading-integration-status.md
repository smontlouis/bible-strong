# Integration status

Active goal: implement the agreed mobile/web daily-reading and reading-plan redesign. This file records progress, not completion.

## Implemented so far

- Calendar primitives for fixed plan dates and calendar-bound meditation entries; explicit new editorial kind/date fields with legacy adapters.
- Audited Spurgeon date correction during lookup, preserving existing IDs and preferring new explicit calendar metadata. The missing December 31 text is not yet bundled.
- Daily-source preference in user settings, including explicit null writes on return to standalone mode.
- Content acquisition defaults to no enrollment; explicit start date and independent progress for reading plans.
- Separate reading-plan and collection library screens, collection preview and selection, meditation reader/date navigation, and configurable home verse card.
- Scheduled plan detail/start screen, existing-progress retention, missed-reading access and configurable reminder time.
- Native centralized reminder scheduling with namespaced IDs, owner/date destinations, 28-day horizon and a combined 48-notification cap. Web indicates that notification delivery is mobile-only.
- Intentional design direction recorded in daily-reading-design.md. Desktop dark-theme collection/plan/home screens and the initial iPhone plan screen have been visually inspected. Long descriptions were moved below actions and cover sizes adjusted after inspection.

## Checks run

- Targeted tests: 97 passed (calendar, scheduling, participation, source preference, import and existing plan-tab behavior).
- Typecheck: passed after current core changes.
- Web export: passed; rerun only if later changes affect the bundle.
- Styling guard: passed.
- Full Expo tests: 358 suites passed, 3 failed (2,328 passed tests; one failed test). Failures are in BibleVerseDetailCard-test, settings/Verse-test and FiltersHeader-test, outside edited areas. Do not claim a proven clean baseline; inspect/reproduce independently if needed.
- React Doctor ran against its chosen master/origin-master range (69 files), score 83; it included unrelated files and does not constitute coverage of all new untracked components. Run with an appropriate scope before completion.

## Required follow-through

- Complete native iOS flow checks and Android checks; validate mobile quotation clipping, safe areas, light/dark themes, web keyboard focus and English/plural labels.
- Add behavioral component coverage for source selection and the visible day/destination relationship; calendar/reminder pure tests are already present.
- Finish notification denial/error feedback, legacy notification cleanup analysis, startup/background destination tests and document the finite scheduling horizon honestly. Verify cold-start plan loading and selected-day destinations.
- Ensure preview cannot mark progress from any menu, including when opening within a persisted tab.
- Review old plan/collection entry points, command-palette and persisted-tab recovery; keep legacy completion history accessible without inventing years.
- Complete explicit-date navigation beyond previous/next where useful, and ensure returning to default source and missing-date fallback preserve the chosen collection appropriately.
- Complete external calendar verification of other collections; internal label consistency alone is insufficient. Import the verified missing Spurgeon final entry as a provenance-backed content artifact before marking the correction complete.
- Validate source passage/reference separation and all publisher locator formats with the audited content, then confirm sharing and reading font preferences.
- Finish validation per docs/agents/validation.md. Do not mark the goal complete while these items remain.

## Local test runtime

Metro was started on port 8081 with development configuration. The pre-existing browser tab on port 9090 belongs to the user and was not changed. A separate guest browser tab on 8081 was used to choose Avec Dieu Chaque Jour and verify the matching home quotation and full reader. No production account settings or content were written.

Native follow-up: after hot reload, the iPhone 17 Pro client stopped responding reliably to navigation. Argent debugger-connect found the correct Metro target but reported connected=false; an isolated app restart was attempted. Investigate this before claiming native flow completion. Only this device and its debugger services were cleaned up; the other booted simulator was not operated.

Latest targeted lint: zero errors, four warnings (three default DateTimePicker import-name warnings and one pre-existing unused middleware helper). Latest TypeScript and styling guard pass. Metro on 8081 remains available; the separate browser QA tab was marked for handoff.

## Continuation: participation, reading and navigation

- Completed explicit participation guards in both UI and the progress mutation. Empty legacy download records are previews; legacy records with actual progress remain resumable without invented dates. Unknown reading IDs do not modify state, orphaned completed IDs remain preserved but do not distort completion totals, and meditation previews cannot write new undated history.
- Home now presents all followed reading plans rather than a cached or arbitrarily selected single plan. The bundled starter is loaded independently of meditation downloads and added idempotently.
- New reading links carry identifiers; old serialized plan/reading links recover identity only and load current content. Malformed links are handled. Persisted plan tabs also recover missing downloaded content with loading/retry states.
- Added native calendar-sheet and browser date-input controls for meditation browsing and scheduled-plan day selection, plus existing reading-format controls in the meditation reader.
- Separated unambiguous trailing references on the daily card without changing quotation wording. Source quotation remains available to accessibility and sharing; font preferences apply to the card and text reader. Other reference shapes remain intact. Added a reproducible whole-catalog opening audit (4,070 single trailing raw references, 670 other forms, nine unrecognized forms; all 4,749 opening roles verified).
- Added component behavior tests for displayed date/destination, reference presentation, chosen font, sharing and explicit fallback. Targeted suite now passes 126 tests. Typecheck, current web export, styling guard, architecture gate and domain quality gate pass. Architecture/quality reports were regenerated by their canonical commands. Last targeted ESLint had no errors; the remaining new DateTimePicker default-import warning was subsequently changed to the equivalent named export.
- Native validation now verified the source library, preview reader, date-sheet selection (September 14 to September 13 with matching content), explicit collection selection, matching home quotation/reference, and return to the default source. Tested on the iPhone 17 Pro with a dedicated development Metro server on port 8082. The earlier apparent freeze was an OS Open-in-app confirmation hidden from fallback accessibility inspection; screenshots exposed it. The Expo dev-menu floating control can also overlap the home source control in development, so inspect the actual overlay before diagnosing app navigation.
- The native guest source preference was restored to the standalone verse after testing; reminder remained disabled. No production account/content was written. The downloaded editorial preview remains cached.
- Inactive carousel cards are now hidden from accessibility and hit testing; native inspection confirms only the active card's actions are exposed.

### Still not complete

The goal remains active. Outstanding scope includes editorial source-calendar validation and the missing Spurgeon final entry, remaining legacy collection/tab experience and history access, notification delivery/denial/background tests and scheduling-horizon handling, account-transition/source-selection race tests, Android validation and remaining desktop/English/dark-mode checks. The latest tests do not prove those items complete.

## Continuation: notification delivery and permission handling

- Added a serialized, testable OS reconciliation boundary: unchanged notifications are retained, obsolete owned requests are canceled, failures are surfaced and retries recover. A superseded or different-owner snapshot cannot continue creating reminders. Already displayed same-owner readings remain openable; other-owner destinations are removed on account changes.
- Explicit permission requests now happen in the enable control. Refusal does not enable a reminder; the settings screen shows denial and an action to open OS settings. iOS uses Linking.openSettings because the installed Notifee openNotificationSettings implementation is Android-only. Android checks whether a channel exists before inspecting whether it is blocked.
- Reconciliation is no longer gated on Bible-resource restoration. Reminder content acquisition is deduplicated through the existing query cache, without enrollment; public content can be recovered when a synced preference reaches another device.
- Added a durable device-local press inbox and validated, deduplicated routing for foreground, background and initial events. A dedicated daily-verse route retains the original standalone source and date after the user changes their preferred collection. No arbitrary notification route is accepted.
- Legacy Android requests retain the old channel marker. Legacy iOS requests are adopted only when a single request matches the old creator's generated-ID/empty-data/greeting/Bible-reference/one-day-timestamp shape; ambiguous requests remain untouched. The migration rule is grounded in the installed SDK validator and the old app creator, not just the notification title.
- The rolling 28-day / combined 48-request horizon is now visible per scope in settings. This is not an unlimited background scheduling guarantee; the final product/completion audit must retain that limitation.
- Targeted suite: 157 tests pass, covering permission controls, OS adapters, concurrent reconciliation/logout, retry, pending-event persistence/deduplication, source/date routing, legacy recognition and existing reading behavior. Typecheck and targeted lint passed during this continuation; web export passed with the new standalone route.

### Native verification evidence

On the iPhone 17 Pro, with Metro 8082 and a guest session: refusing the system prompt left the reminder off and displayed the denial explanation; enabling permission in iOS Settings was recognized on return. Enabling the reminder created 27 actual OS pending requests for the next days (verified through Notifee's read API). Changing the time through the native wheel to 08:50 produced an actual banner at 08:50 on 2026-09-14 with the app backgrounded. Disabling afterward left zero pending requests (verified through the OS API). The test banner was removed explicitly. App preference is again disabled and standalone; the simulator's OS permission is now allowed after the grant test.

Tapping the OS notification remains unverified end-to-end: system-surface tap automation did not activate the notification, and the fallback desktop Simulator surface was inaccessible because the Mac is locked. The validated inbox/routing tests are not a substitute for this remaining OS interaction check. Do not mark the goal complete on that basis. In addition, the generic iOS Settings link opened the Settings app but this simulator required manual navigation through Apps to reach the app's notification setting.

Native debugger module IDs can be stale after export-shape changes under Fast Refresh. A targeted CDP reload on Metro 8082 loaded the new exports; inspect the actual module registry when debugging, rather than assuming an old module has updated. Only the iPhone 17 Pro was operated. Other simulators and the user's 9090 browser session were not changed.

## Continuation: confirmed editorial reference

The user selected the official PDF calendar for Houstin. Persisted the source comparison metadata for the eight EGW collections, English Spurgeon, and Houstin PDF/EPUB. Added title-guarded Houstin date corrections to daily lookup, retaining all legacy IDs. The EPUB-only reading 293 is excluded from daily lookup but remains stored. Complementary-reading presentation, July 17 and December 31 recovery, and shared normalization across legacy collection views remain outstanding. Spurgeon supplements exist locally but are not wired yet. These partial changes do not complete the editorial integration.

## Continuation: shared calendars and collection browsing

- Added a read-time calendar projection shared by daily-content hooks and computed legacy plan/tab content. Cached publisher content and all completion IDs remain unchanged. Explicit null dates identify complementary readings. Existing matching publisher dates supersede corrections and supplements.
- Wired the verified Spurgeon supplements: French December 31 and English February 29, guarded by complete-corpus anchors and legacy revision. Calendar lookup, daily verse and reminders share the same resolver. Incomplete/different revisions are not supplemented silently.
- Replaced meditation collection lists in old tabs with month browsing, date selection, a direct selected-reading action, complementary-reading access, and explicitly undated previous-read labels. Reading plans retain their separate participation UI. Removed reset/stop-plan actions from collection menus. Added library links from source details and the daily reader.
- The new calendar and complementary route were exercised in the dedicated localhost:8081 guest browser (dark theme). Houstin complementary ID 293 opens its full existing text through the stable-ID route. Found and fixed an empty heading in the legacy reader; date-selected action now appears above the month list. Native/Android validation of this new surface remains to do.
- Calendar tests now include all mapped Houstin dates, input immutability, idempotent normalization, preservation of all 365 legacy identities, supplementary date guards, and English/French Spurgeon differences. Component tests cover month selection, complementary access, old history labels, tab callbacks, and identifier-only navigation.
- Remaining editorial work: Houstin missing July 17/December 31 source additions, Chambers exception verification and La Bonne Semence calendar. Remaining product validation includes native/Android new collection surface, notification press, account/source-selection races and full completion audit. Goal remains active.

## Continuation: source-selection races and remaining Houstin dates

- Source selection now observes account and preference transitions throughout content acquisition. Any intervening change invalidates the request, including logout/login back to the same ID. Leaving/changing collection details cancels applying the choice; repeated clicks cannot start concurrent selection requests. Failures from an obsolete request do not show against another account. Six behavior tests pass.
- Added the missing Houstin July 17 and December 31 entries after paragraph-by-paragraph normalized comparison of the official EPUB transcription with the user-selected PDF. The PDF intentionally repeats the same meditation July 17/18; preserved this calendar. There are now 366 dated readings plus complementary legacy ID 293. Evidence, attribution, source hash and license are retained. Calendar tests verify 367 total identities and repeatable normalization.
- Earlier targeted typecheck/lint and the six race tests passed; the updated 12 calendar tests pass. Remaining work still includes Chambers/La Bonne Semence source checks, platform QA and the final full-scope validation audit.

Final checks for this continuation: 99 tests passed across 13 plans/daily-reading suites; Expo typecheck and targeted ESLint passed; `web:export` completed successfully (log `/tmp/bible-strong-daily-reading-web-export.log`). These checks do not replace the outstanding platform/editorial checks.

## Continuation: Android environment and global discovery

- Updated command-palette destination/scope copy to Plans & Méditations and added meditation/recueil/devotional aliases. Web suggestions, native tab picker and catalog-search results identify whether each item is a plan or a collection; stable plan-tab IDs continue to work. Native picker no longer uses the old progress/crown card for collections.
- Typecheck, targeted ESLint, 22 command-palette tests, styles, architecture (457 warnings), and domain quality gates pass for this continuation.
- Android AVD Pixel_6_Pro_API_36 booted headlessly on emulator-5554. Argent boot initially used the obsolete SDK tools/emulator binary; the installed SDK emulator/emulator 36.6.11 starts correctly. Emulator process is exec session 6194. Existing com.smontlouis.biblestrong production app has not been replaced or cleared.
- Generated ignored apps/expo/android with `CI=1 yarn workspace @bible-strong/expo exec expo prebuild --platform android --no-install`. No package.json or tracked config changes. Local generated debug build has applicationIdSuffix .dev; generated google-services.json client package adjusted to that debug ID only. These are disposable QA build settings, not a production config change.
- Android build first failed due to missing SDK path; restarted with ANDROID_HOME=/Users/stephane/Library/Android/sdk and JAVA_HOME=/Users/stephane/Library/Java/JavaVirtualMachines/corretto-21.0.4/Contents/Home. Current **live build session 11957** runs `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`; log `/tmp/bible-strong-reading-android-build.log`. Poll that session before starting any other build. APK target apps/expo/android/app/build/outputs/apk/debug/app-debug.apk. Once built, install debug package without modifying existing production app, reverse Metro 8082, and use the dev-client URL already documented. No Android UI verification yet.

## Continuation: native verification and Android client built

- Android debug build session 11957 completed successfully in 6m36s (1,097 tasks); APK verified as com.smontlouis.biblestrong.dev 27.0.13/500 and installed alongside production on emulator-5554. Original AVD is RUNNING_LOCKED and requires an unknown unlock pattern, which explains launcher/deep-link resolution failures; no credential guessed or reset. Stopped only its Argent services and shut down this session's emulator, retaining data.
- Created separate **Codex_Reading_API_36** AVD metadata using the installed API36 image and existing hardware profile, without copying user data. Legacy avdmanager is incompatible with modern Java; metadata creation avoids installing/upgrading tools. Reduced only the new AVD data partition to 2GB because 6GB exceeded available disk. New emulator launch is tracked in the next session note; log `/tmp/bible-strong-reading-test-emulator.log`. Install the existing built debug APK there when ready; original production app remains untouched.
- iOS Metro8082 targeted reload refreshed stale JS. Verified new collection layout in light mode, tapping complementary-readings toggle and opening Houstin ID293. Dated deep link 2024-12-31 renders the newly added title, opening reference Apocalypse19:7-8 and full body. Tapping next from that screen did not change the observed date and still needs investigation (do not claim year-boundary UI passed).
- Chambers research uncovered source-index discrepancies: EMCI/Godieu put Obéir oui mais après on July27, while English publisher source has The Way To Know (John7:17) and After Obedience (Mark6:45-52) as separate readings. Local IDs308/309 match those respective texts. Do not apply Godieu mismatching headings blindly. Further primary date evidence remains needed.

The clean AVD image enforces a ~6GB minimum userdata allocation despite a smaller config request. Removed only this session's generated app/.cxx and app/build/intermediates (~1.5GB), retaining app-debug.apk and all tracked sources. **New emulator process session 35709 is live** for Codex_Reading_API_36; startup log above. Old blocked describe/swipe handles finished/aborted after scoped shutdown. iOS Argent services cleaned up; source preference and notifications were not changed during this verification.

Clean Android AVD booted successfully in 26s, RUNNING_UNLOCKED; installed .dev APK and reversed8082. Logical Metro ID fc1c6c26deef78e35f56c3037d7f0bfeffb1fd45 (iOS also connected on8082, so future debugger calls must disambiguate). Completed onboarding via Skip/Online as guest and dismissed dev-menu tutorial/changelog. New Android UI was verified in English: calendar default Sep14, native date-picker selection Sep13, matching Caractéristiques de l’amour(1), and Read action opens the matching complete reader. Default Bible resource unavailable locally, but meditation public-content acquisition works independently. No source preference or notification enabled yet. New AVD and emulator session35709 retained for continued QA.

The Android reader revealed that old collection routes still inserted the large breathing-animation prelude, unlike the daily reader. Removed that prelude for meditation collections only and aligned title spacing; reading-plan behavior remains unchanged. Recheck visual result after Fast Refresh. iOS year-boundary next tap still needs investigation. Native reminder Android permission/delivery and the remaining full audit are not complete.

Post-change Android screenshot confirms the collection reader now starts at its title and passage with readable body below; no breathing prelude remains. Expo typecheck and targeted reader ESLint pass. Android Argent services were scoped-cleaned at turn end; the clean QA emulator remains running for the next validation session.

## Continuation: iOS navigation resolved; Android permission lifecycle

- iOS next-day issue was the Expo floating Tools button intercepting the right-side touch region. Read-only/runtime inspection proved setParams/date calculation worked. Disabled only the development Tools button through its dev-menu switch; afterward actual Previous/Next taps crossed Jan1/Dec31 correctly, with matching title and route date. This is a dev overlay issue, not a reader code defect. Tools button remains hidden in this QA dev client.
- Android first permission prompt refusal leaves reminder off. Found a genuine settings-link bug: first-time denial attempted CHANNEL_NOTIFICATION_SETTINGS before the channel existed. Driver now opens app-level notification settings when permission is globally denied or the channel has not been created, and existing-channel settings otherwise. Six permission-adapter tests pass, including both new branches.
- Verified corrected settings link opens the app's Android notification page; granting permission is recognized upon return. Enabling schedules through October11; OS JobScheduler registered20 WorkManager jobs for the dev app. Disabled test reminder afterward; cancellation observed through OS job count (final count recorded below). This verifies scheduling/cancellation but NOT actual Android delivery/tapping yet.
- One Android Hermes SIGSEGV occurred while attaching Argent debugger after the earlier bad settings link (10:04:08, JS timer/JSI stack). Causality is not established; no Java application exception. Restarted dev client and completed the corrected settings/enable/disable flow without debugger attachment. Avoid treating that crash as a proven feature defect or proven fixed; retain for final QA audit.
- All app reading preferences are standalone/reminder-off at cleanup. Android OS notification permission remains granted after the explicit QA grant. The clean AVD remains available for further delivery tests.

After disabling, one app WorkManager job remains but **Notifee's actual work_data table contains 0 rows**, verified by a read-only snapshot of the test app's notification database (including WAL). Thus no Notifee reminder records remain; do not claim all app jobs were removed. Typecheck passed. Targeted lint formatting was corrected with ESLint's configured formatter and passes. Scoped Argent services cleaned up for both QA devices and logical IDs.

## Continuation: Android delivery test and Bible Project identity

- Active Android test reminder set through the UI to **10:15 on 2026-09-14**, standalone source; app sent to background using Home. Native JobScheduler20 entries verified after enabling. **Must disable afterward**; previous cleanup state is superseded while this delivery test is active.
- Compared both bundled/remote Bible Project variants: same358 ordered reading IDs, no missing identity and no scripture-block differences. FR differs on9 video URLs and1 description; EN on6 video URLs. Reproducible script and metadata-only JSON added, no content publication. The correct actual duration is358; do not label these as365 automatically.

## User handoff: stop broader refactor, focused daily-reading design changes

The user explicitly stopped the remaining broad feature work and will handle it themselves. Do not resume the outstanding editorial/notification investigation automatically. The only subsequent authorized task was the daily-reading layout adjustment, now implemented: no reminder surface on web; native reminder first with bell; existing FiltersHeader button at top-right; default French and English sections, language filtering; compact horizontal cover/title/author rows; direct selection circles matching the standalone choice and checked state. The original details preview remains separate from the selection action. Web and Android layouts/filter were inspected. Temporary ReadingReminder QA logs removed and the leftover Android test reminder disabled. Remaining broad feature work is handed back, not claimed complete.

## Focused follow-up: one meditation reader

At the user's request, unified the two visible meditation reading flows. `/meditation-collection` owns collection browsing; `/meditation` owns dated and ID-based meditation reading, including complementary entries. Old daily/plan/plan-slice meditation routes redirect; persisted plan tabs use the same reader internally and preserve chosen dates in `meditationDate`. New cards, previews, collection items and notification destinations use canonical routes. Reading plans retain their separate reader. Formatting and sharing are available in the unified meditation reader. Validation: 110 targeted tests passed, web export passed; no Argent flow was run, per the user's preference. This follow-up does not resume the stopped broader notification/editorial work.
