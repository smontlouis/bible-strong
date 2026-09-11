# Expo analytics

Expo uses platform adapters in `apps/expo/src/helpers/analytics{,.web}.ts`. Native
uses React Native Firebase; the browser uses `firebase/analytics` against the
existing Firebase Web app. Delivery is ordered, best effort, and cannot reject into
navigation/authentication. Unsupported browsers skip collection.

## Configuration and release verification

- Register the Expo browser application in the intended Firebase project and link
  its Web data stream to the same GA4 property as iOS/Android when combined reporting
  is desired. The public site is a separate deployable product.
- Supply the Firebase Web variables in `apps/expo/.env.example`, including
  `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` (the Web stream's `G-...` ID), at export time.
  Expo public variables are embedded in the bundle; changing hosting environment
  variables after exporting does not update them. Missing measurement ID disables
  collection with an observability warning.
- In the GA4 Web stream's Enhanced Measurement page-view settings, disable page
  changes based on browser history events: Expo Router explicitly emits page views.
  The adapter also sets `send_page_view: false` to suppress the initial automatic
  page view. Avoid adding a second GA/GTM tag to the hosting HTML.
- Normal development does not collect. For a dedicated validation build, set
  `EXPO_PUBLIC_ANALYTICS_DEBUG=true` before starting/exporting, then use GA4 DebugView.
  Remove the flag from normal production builds. Native debugging uses Firebase's
  platform debug facilities.
- Check an initial load, client navigation, browser back/forward and reload: one
  `page_view` per navigation. Check login and logout, then verify new anonymous
  events do not retain the account's `user_id`.
- Verify signup, note creation versus editing, plan addition, and marking/unmarking
  a plan reading. Check Network for GA collection requests and DebugView for receipt.
  Ad blockers may prevent collection; the application must remain usable.

## Events and data

| Event | Trigger | Custom parameters |
| --- | --- | --- |
| `page_view` (web) | Initial route and pathname changes | Template path/location, template screen name |
| `screen_view` (native) | Initial route and pathname changes | Screen name/class |
| `login` | Successful explicit existing-account authentication | Provider `method` |
| `sign_up` | Successful confirmed new-account authentication | Provider `method` |
| `note_created` | A note action inserts previously absent keys | `count` |
| `plan_started` | A plan is first added to the user's plans | None |
| `plan_reading_completed` | A reading becomes completed | None |

Restored sessions set identity without emitting `login`. Logout clears identity.
Account linking and unclassified authentication do not count as signups/logins.
No note text, search text, email, or display name is passed as a custom parameter.
Route templates replace dynamic values and omit query strings in `page_location`.
GA may still collect its standard browser metadata; this is not an anonymization
or consent-management implementation. Existing search telemetry remains a separate
Resource-service pipeline (`/v1/search-events`), not a GA event.

These events measure navigation/actions, not time spent reading a chapter. There
is no inferred Bible-reading completion event.

## Local verification (2026-09-10)

- Expo production Web export and TypeScript check passed.
- Targeted ESLint passed; 11 tests passed across analytics delivery, browser SDK,
  action transitions, and browser auth cleanup.
- Chromium emitted exactly three explicit `page_view` events for `/` → `/more` →
  browser Back to `/`. A real GA `/g/collect` request was attempted.
- DNS resolution of `region1.google-analytics.com` and the Analytics console failed
  locally. Server receipt, DebugView, and the stream's Enhanced Measurement settings
  remain unverified; do not interpret local emission as confirmed GA ingestion.
- React Doctor reported existing findings outside the modified analytics files
  (63/100 across its broader branch comparison). Architecture validation passed
  with the repository's existing warnings.
