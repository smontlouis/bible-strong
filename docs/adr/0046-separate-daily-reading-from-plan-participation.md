# Separate daily reading from plan participation

A reading plan has ordered days and a user-chosen civil start date. Missed readings do not alter its calendar. Participation and completion are independent for each plan.

A meditation collection has entries assigned to editorial calendar dates. The daily-reading preference chooses either the standalone verse source or one collection. In collection mode, its opening passage supplies the verse card and opening the card leads to that date's complete meditation. Acquiring content does not implicitly select it or start a plan.

Keep this preference in synchronized user settings; keep device notification identifiers local. Preserve existing completion identifiers and leave legacy completion dates unknown. Do not infer a user's chosen source from their downloaded content or a start date from old progress.

Legacy editorial type labels need explicit normalization. Calendar labels also need source verification: the Spurgeon collection has internally consistent labels but a confirmed editorial shift after February. A migration must preserve content identity when correcting dates and must not substitute positional inference for evidence.

Existing plan tabs continue to store identifiers and use internal reading state, as specified in ADR-0001 and ADR-0002. The content renderer is shared; calendar and participation rules are distinct.

Notification permission is requested only by an explicit enable action. OS permission and delivery status are device state, separate from the saved reading preference. A serialized reconciler retains identical scheduled requests, cancels obsolete owned requests, and prevents stale account snapshots from scheduling after logout. Permission denial and delivery errors are visible in settings.

A device-local notification inbox retains a background press until navigation and account hydration are ready. Destinations are validated and bound to the original owner, content identity and civil date; duplicate initial/foreground events are consumed once. Dated standalone verse notifications use their own reading route so a later meditation-source choice cannot redirect them.

The current implementation prepares a bounded rolling window of date-specific notifications under the native pending-request limit. Settings report the last prepared date, and opening the app renews the window. This limitation must remain visible and must not be represented as an unlimited background service.

For « 365 jours pour ranimer la flamme », the user chose the author's official 2020 PDF calendar on 2026-09-14. The EPUB contains an additional July 12 reading (legacy ID 293, « L’unité du Corps de Christ »). Preserve this reading and its completion identity as complementary content, without allowing it to replace the PDF's daily reading. Corrections apply only to matching audited legacy titles; future explicit publisher dates take precedence.

Meditations use one reader (`MeditationReader`) from both calendar and daily-card entry points. Canonical routes are `/meditation-collection?collectionId=…` for the collection and `/meditation?collectionId=…&date=…` or `readingId=…` for the reader. An explicit reading identity takes precedence; complementary readings have no fabricated calendar date. Legacy `/daily-meditation`, meditation `/plan` and `/plan-slice` links redirect to these routes. Existing identifier-based plan tabs classify their content and render this same collection/reader internally; optional `meditationDate` retains date navigation without serializing content or inventing completion history. Reading-plan routes and their reader remain separate.
