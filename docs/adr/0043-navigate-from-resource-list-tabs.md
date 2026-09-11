# ADR-0043: Navigate from resource list tabs

- Status: Partially superseded by ADR-0045 (new-tab creation only)
- Date: 2026-09-07

Creating a lexicon, dictionary, Nave, notes or studies tab opens its list directly.
Creating a commentary tab opens its list without an initial passage picker.
Selecting a list item navigates to the existing detail route instead of changing
the tab's resource identity. Commentary section lists follow the same rule.

The list remains available with its existing filters and scroll position.
On Web, contextual routes use the responsive right panel; native route
presentations remain unchanged. Users explicitly create detail tabs through the
detail screen's open-in-new-tab action. Existing persisted detail tabs remain
supported; no user tab data migration is required.

Bible chapter navigation and the initial comparison passage picker are outside
this list-to-detail navigation rule.
