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
managed by Expo Router, and native sheet presentations remain native.

On Web at window widths of 768 pixels or more, the existing form-sheet route
groups render in a right panel occupying 45% of the available content width,
capped at 500 pixels. The left sidebar docks only if the projected main content
retains at least 640 pixels after allocating its 260 pixels and the open route
panel. With no panel this permits docking on narrower windows. Once floating,
the sidebar requires 48 additional pixels of main-content space before docking
again, preventing oscillation near the limit. This geometry is resolved centrally
for the workspace and all route frames; only the workspace commits the shared
docking state. Eligibility is evaluated with the sidebar present even if manually
hidden, avoiding a visibility/available-width feedback loop. Manual hiding remains
independent and is preserved when space returns. In floating mode, navigation
starts closed and opens over the content. A floating
restore button does not add a header row. The study surface or previous ordinary
route keeps the remaining space; no empty right column is reserved when the panel
is closed. Below this breakpoint the same route frame fills the main content area (and the
entire window below the sidebar breakpoint). The Web presentation and wrapper
tree stay mounted across resizing so nested routes, parameters and history are
not reset. The policy
uses the window width, sidebar allocation, open route panel and previous docking
state; it does not depend on parallel Bible mode. Route parameters, nested
navigation and browser history remain owned by Expo Router. Bottom-sheet action
menus remain separate from this route presentation. No per-tab route histories or routing interception
are introduced. The shared native Bible DOM host remains mounted with its study
surfaces in either layout.

The shared Back control checks Expo Router history before dispatching a back
operation. When a direct link has no previous route, it replaces the current
route with `/`. Resource screens with custom back handlers use the same fallback
when outside a persisted tab; tab-local returns keep their existing behavior.
