# ADR-0041: Adapt workspace navigation to available width

- Status: Accepted
- Date: 2026-09-07

## Decision

The shared workspace layout uses a sidebar at widths of 768 logical pixels or more,
regardless of platform. This includes native tablets and wide browser windows.
Below that threshold, both native and Web use the existing mobile bottom bar,
tab grid, preview carousel and Home/Settings drawers. There is no horizontal Web
tab strip. Tablet split-screen windows may use the compact layout.

The wide layout owns cached study surfaces and keeps the sidebar visible around
Expo Router pages. Home and Settings are ordinary routes, not persisted tabs.
Selecting a content tab returns to the root route. Only a focused, empty wide root
route redirects to Home; opening a direct URL must not be overridden at startup.
The compact root route owns its study surfaces and drawers. Crossing the breakpoint
remounts those surfaces, while tab identities and study data remain in shared state.
The router itself stays mounted across resizing.

Platform adapters still own platform behavior: browser URLs and history remain
managed by Expo Router, Web route sheets are ordinary pages, and native sheet
presentations remain native. No per-tab route histories or routing interception
are introduced. The shared native Bible DOM host remains mounted with its study
surfaces in either layout.
