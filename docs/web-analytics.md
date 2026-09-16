# Web analytics

Firebase Analytics uses the measurement ID from the Expo production environment.
Development tracking is disabled unless `EXPO_PUBLIC_ANALYTICS_DEBUG=true`.

- `page_view`: Expo Router navigation, using route templates instead of concrete
  account/document identifiers or query parameters.
- `study_tab_view`: an active study tab becomes visible on the workspace root.
  Only `tab_type` is transmitted. The tab ID is used locally for deduplication.
- `workspace_drawer_view`: compact Home or Menu opens, with `screen_name` set to
  `home` or `menu`. Returning to the underlying tab records another tab view.
- `plan_started`: the `startPlan` action creates actual participation. Downloading
  a plan, automatically loading BibleProject, hydrating state or changing an
  existing participation's start date does not count as starting a plan.
- `plan_reading_completed`, `note_created`, `login`, `sign_up`: existing product
  events, without note contents or user-authored titles.

Workspace views do not generate extra `page_view` events. Tab changes behind a
non-root route and while the tab overview is displayed are not counted as views.
An SDK or delivery failure must not prevent navigation or authentication.

## Validation

Run the analyticsCore, analytics.web, analyticsMiddleware and workspaceAnalytics
Jest suites. For browser validation, use a disposable guest session and enable the
analytics debug flag on a test build to inspect GA4 DebugView. Check Home → Bible →
lexicon → FAQ, compact Home/Menu reopening, and a first plan start versus changing
its start date. Each visible transition should produce one corresponding event.

A locally blocked analytics endpoint (`ERR_NAME_NOT_RESOLVED`) prevents confirming
receipt in GA4 even when SDK calls are correct. Do not bypass browser or network
privacy protections to make analytics work.
