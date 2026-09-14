# Reading plans and a configurable verse of the day

Status: revised product specification and incremental implementation plan, 2026-09-14. Product direction reflects the latest user request. Defaults explicitly marked as proposed remain recommendations. Local implementation is in progress; production data has not been changed. See daily-reading-integration-status.md for verified progress and remaining work.

## Problem Statement

The current experience mixes date-based meditation collections with reading programs. Downloading content creates a followed plan, progress has no start date, and reading one plan resets the active status of other plans. The interface does not clearly communicate today's reading, schedule or reminder behavior.

The home experience needs one configurable verse-of-the-day surface. The user may retain the existing standalone verse, or select a meditation collection whose daily opening passage supplies that verse. Opening the card in collection mode must open that day's complete meditation.

The earlier proposal to keep two separate home blocks for the verse and the preferred meditation is superseded by this specification.

## Solution

Provide two complementary products:

- **Daily reading:** a verse-of-the-day card with a selectable source: the existing standalone verse service or one meditation collection. Collections follow their editorial calendar, without a start date or accumulated reading debt.
- **Reading plans:** ordered programs started on a chosen date, with a fixed schedule, independent completion tracking and optional reminders. Missing a day never shifts later days automatically.

Reuse the existing content-rendering capabilities across both products, while separating editorial content, personal preferences, participation and delivery state.

## Decision Document

### Confirmed product behavior

1. Default mode preserves the existing standalone verse of the day. It is not attached to a meditation.
2. Selecting a meditation collection replaces the card's verse source with the opening biblical passage of that collection's entry for the displayed date. It does not pair a meditation with an unrelated verse.
3. The card identifies the selected collection. Its main action opens the complete corresponding meditation, including the opening passage and subsequent content.
4. Users can change the selected collection or return to standalone verse mode. Exactly one source supplies the home card at a time.
5. Collection entries correspond to editorial month/day dates. Users can browse other dates; there is no requirement to complete yesterday's entry before reading today.
6. Reading plans use relative day numbers mapped to a selected start date. The initial calendar stays fixed when readings are missed. Users can access missed readings and follow multiple plans independently.
7. Reminders are part of the daily-reading and reading-plan experience, with explicit user choice and a configurable time.
8. Existing completed readings must be preserved by content identity. Do not fabricate historical completion dates or plan start dates.
9. The design must work on mobile and desktop, in French and English, and accommodate future plans of arbitrary duration.

### Daily-reading flow

- Home shows the date, verse text and biblical reference. Collection mode additionally shows the collection name and an action to read the full meditation.
- A source selector offers the default verse and a library of meditation collections with covers, language, author and preview. Inspecting or downloading a collection does not select it automatically.
- An explicit action selects a collection as the verse-of-the-day source. Changing source preserves reading history and open content tabs.
- Selection is a preference, not a reading-plan enrollment. Other collections remain available in the library without creating competing home cards.
- In standalone mode, preserve the existing Bible-reading interaction. In collection mode, the primary card action opens the meditation; its biblical reference can offer a separate action to open the Bible.
- Previous-day browsing resolves the chosen source at that displayed date. It must not open today's entry from a card showing another date.
- Share actions use the displayed passage and reference. Do not reuse images or share metadata belonging to the default verse when a collection passage is displayed.
- Collections retain their editorial passage wording. Do not silently replace the quotation with an unrelated Bible version; opening the reference in the Bible may use the user's selected version.
- Long or multiple-verse opening passages must remain readable, with an accessible expansion or full-reading action. Existing fixed card height must not clip them.

### Daily reminders — proposed defaults

- One daily-reading reminder follows the selected source. Switching collections does not create additional parallel reminders.
- Retain an existing enabled reminder's time when changing source; do not enable reminders for someone who disabled them.
- A reminder destination identifies the date and source it was created for. Opening an older notification must not silently open a different collection selected afterward.
- Reading plans have independently configurable reminders. Completing, leaving or disabling a plan cancels its future reminders.
- A reminder can point to the appropriate content without embedding the entire passage in its notification text.
- Implement device permission handling and reconcile scheduled notifications after account or preference changes. Inspect the current notification delivery path before choosing implementation details.
- Target native iOS/Android reminders first. Determine browser push support separately; the web UI must accurately show its capabilities rather than imply notifications were enabled when delivery is unavailable.

### Calendar and unavailable-content defaults — proposed

- Use the device's local calendar date for today's meditation. Schedule arithmetic uses civil dates rather than elapsed 24-hour intervals.
- If a collection lacks February 29, retain the selected collection and explicitly explain that no entry exists for that date. Offer the standalone verse as a temporary fallback, visibly identified as such. Do not relabel another meditation or shift March 1.
- A temporary download failure must not change the saved selection. Show retry and an explicit option to read the standalone verse; do not silently substitute sources.
- A February 29 entry remains available through the collection library in non-leap years.
- Unfollowing/removing access to the selected collection explicitly returns the home source to the default verse. Removing downloaded content alone must not erase the source preference.
- Pausing plan reminders does not move the original schedule. Do not introduce automatic catch-up or schedule rewriting.

### Reading-plan experience

- Discovery cards show covers, duration and language; a detail screen offers description, author and a preview before enrollment.
- Starting selects a date and optionally a reminder. Loading a preview or acquiring content does not start a schedule.
- The followed-plan screen shows the scheduled day, completed progress and access to missed readings, without blocking navigation to other days.
- Completion is explicit and reversible. Opening a page alone does not mark it completed.
- Multiple plans remain active independently. Completing one reading must not deactivate other plans.
- A complete meditation entry is an ordered set of content blocks, not a requirement for a separate swipe slide for every paragraph. Final reader presentation should be established with mobile and desktop mockups.

### Verified content and migration findings

The published catalog contains 13 meditation collections and two Bible Project language versions. Static Bible Project assets are still used from the home feature. Their coexistence with remote versions requires identity/content comparison before migration; do not assume every source is interchangeable.

Every one of the 4,749 inspected meditation entries starts with a Text block whose subtype is devotional, and each entry contains exactly one such block. This provides an explicit legacy role for the opening passage. Some blocks also include editorial locator lines. The passage text, biblical reference and editorial citation are not already separate structured fields: extraction must be validated, preserve the source text and retain a safe display fallback if reference parsing is ambiguous.

The initial calendar audit verified internal date-label consistency only. External comparison of Les trésors de la Foi found the February 29 meditation already stored as March 1, subsequent entries shifted, and the source December 31 meditation missing. Correct this calendar and add the missing final entry without renumbering existing IDs. Other collections still need source-calendar verification before automatic migration; do not equate internally consistent labels with editorial accuracy.

The stored type values are localized display labels rather than the declared TypeScript enum. Introduce a stable editorial classification and an explicit legacy adapter instead of branching on assumed enum values.

Existing completion records have no year. Preserve them as legacy undated reading history; do not mark the corresponding date as completed in the current year. New date-specific meditation history, if recorded, must distinguish yearly occurrences.

Existing plan readers must retain access and progress while choosing their new schedule. Do not automatically invent a start date or overdue count. Stable content identifiers must continue resolving from existing tabs and links, including after entries move between monthly sections.

### Domain and ownership

- Editorial collection: identity, language, cover, author, date-keyed entries and opening-passage metadata.
- Editorial plan: identity, language, arbitrary day count, ordered readings and content blocks.
- Daily-reading preference: default source or selected collection identity. It is independent of downloads and completion history.
- Daily-reading resolver: selected source plus displayed civil date yields passage, attribution, availability and an exact destination.
- Plan participation: start date, independent lifecycle and completion records.
- Reminder delivery: preference reconciliation, device-local scheduling identifiers and durable content/date destinations.
- Shared reader: existing supported text, passage, image and video blocks, with identifier-based navigation.
- User-owned preferences and progress follow existing persistence, guest/account ownership and synchronization rules. Editorial content is not embedded into the synchronized user preference.

## Commits

Each step must leave the application usable. Introduce compatibility adapters before enabling migration, and remove old paths only once their replacements and persisted links are validated.

1. Preserve the current content inventory and source evidence; extend external calendar checks to the remaining collections and compare static/remote Bible Project identities.
2. Prepare the Les trésors de la Foi correction as a reviewable content artifact: corrected dates, unchanged IDs and the missing December 31 entry with provenance. Keep publication separate from application migration.
3. Document the confirmed terminology and ownership in glossary documentation and an ADR.
4. Introduce stable content classification and legacy adapters without changing existing screens.
5. Add explicit calendar keys and opening-passage metadata generation with checks for ambiguous references, editorial locator lines and long/multiple-verse quotations.
6. Add pure collection date lookup and explicit unavailable-date outcomes, including leap days.
7. Add the daily-reading source preference, defaulting to the existing verse for all existing users. Do not infer a preferred collection from download order or the last active plan.
8. Extend persistence, account hydration and synchronization for that preference, including logout, guest adoption and import/export behavior.
9. Add the daily-reading resolver while retaining the current home UI as its first consumer in default mode.
10. Extract the shared reader boundary without changing existing reading behavior or stable tab identity.
11. Build the collection library and detail preview, followed by explicit source selection and return-to-default actions.
12. Update mobile and desktop verse cards to render the selected passage, source attribution, correct destination, long-text behavior and source-selection affordance.
13. Update historical browsing and sharing so they use the selected source and displayed date consistently.
14. Add the full meditation reader with date navigation and source-aware deep links.
15. Adapt the existing daily reminder to follow the daily-reading preference, preserving opt-in state and preventing duplicate schedules.
16. Add pure fixed-calendar calculations for reading plans with tests across month/year and timezone boundaries.
17. Add independent plan participation and an explicit start-date operation; keep legacy progress readable until scheduling is selected.
18. Implement the idempotent state/content migration using validated calendar mappings; retain unmapped and undated legacy records for recovery.
19. Verify synchronization compatibility and ownership before enabling migrated state for existing accounts.
20. Build reading-plan discovery, details and preview without implicit enrollment.
21. Add date selection and the scheduled plan-day screen, progress, missed-reading navigation and independent plan lifecycle actions.
22. Implement optional per-plan reminders, cancellation and exact destinations.
23. Replace the mixed plans/meditations entry experience with distinct library and plan journeys; retain clear access to the daily-source selector.
24. Update home plan cards, command-palette results, open tabs and existing routes; remove dependence on a single active-plan status.
25. Complete French/English copy, accessibility, mobile/desktop visual checks, offline/error states and notification lifecycle checks. Remove obsolete code only after compatibility validation.

## Testing Decisions

Build on existing progress, reducer and plan-tab tests. Test behavior rather than implementation structure:

- Default users keep their existing verse and reminder state. Selecting a collection changes both the visible passage and click destination; returning to default restores the standalone behavior.
- Source selection does not enroll a plan, clear reading history, close an open tab or duplicate notifications.
- All supported opening-passage formats preserve quotation text; biblical references and editorial citations are distinguished without guessing. Long/multiple-verse passages remain accessible.
- Displayed date, card content, sharing and navigation destination agree, including previous-day browsing and notifications opened after a source change.
- Calendar lookup covers leap years, missing dates and local midnight; network failure preserves selection.
- The corrected Spurgeon calendar has 366 entries, February 29 at its actual date, unchanged IDs for existing texts and a distinct December 31 entry. Existing completion markers still identify the same texts.
- Other editorial mappings are independently verified before migration; a failed check blocks that content's migration instead of silently guessing.
- Plan dates stay fixed after missed readings. Multiple plans retain independent progress; completion and reversal do not change other plans.
- Migrations are repeatable, preserve undated history and never fabricate an account's start date.
- Account hydration, imports, logout and guest adoption preserve ownership and avoid duplicate or resurrected state.
- Reminder changes reconcile enablement, permission denial, time changes, completion and account changes without stale or duplicate schedules.
- Existing content tabs and deep links reopen correctly after section/calendar corrections.

Use the canonical repository validation matrix at each implementation step: relevant unit tests, typecheck, lint, styling checks, web export and iOS/Android/web manual flows as appropriate. For visual work, verify both mobile and desktop, dark/light themes, empty/loading/error states and screen-reader labels.

## Out of Scope

- Authoring new reading plans or copying Bible.com content.
- Social reading, groups, comments, streaks or gamification.
- Multiple simultaneous meditation cards on home or a general-purpose home-layout editor.
- Automatically selecting a meditation collection for existing users.
- Automatic rescheduling of missed plan days.
- A backend migration as a prerequisite for the feature.

## Further Notes

The only remaining product choices are edge-case defaults, not the central experience: missing-date fallback, notification capabilities per platform and the final visual reader layout. The proposed defaults above make these concrete without treating them as user-approved decisions.

Evidence: [calendar and source audit](../docs/research/meditation-calendar-audit.md). The corrected Spurgeon mapping is a candidate for implementation, not an already published content change.
