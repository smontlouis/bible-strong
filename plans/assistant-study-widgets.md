# Assistant study widgets

Status: complete. All 17 widgets delivered and verified within the documented resource limits. Web first. Private API orchestration lives in ../bible-strong-ai; public UI and wire contract live here.

## Product and design decisions

- Reuse Bible Strong theme tokens, sans-serif assistant typography, existing contextual preview sheets and external-open action. No hover-only information, no generated HTML or arbitrary component trees.
- Compact widgets fit the current 440px assistant. Comparisons stack by default; wider tables, graphs and timelines open an accessible expanded view. Keyboard navigation and reduced motion must work.
- Source text comes from resource adapters or validated successful tool reads, never model-authored quotations. Label model analysis separately. Respect source language, translation, precise lexical identity, revision, pagination and uncertainty.
- Persist widget descriptors with their message. Bound payloads. Reloading must preserve destinations and gracefully handle unavailable or revised resources. Do not replay model or mutation calls on mount/reload.
- A widget action may read/open content. Participation, completion, notes, bookmarks and other personal writes are out of scope unless explicitly requested later.
- Reuse official assistant-ui primitives where appropriate and the app's resource UI; do not create substitutes for existing primitives or revive removed hover citations/JEV debugging UI.

## Delivery checklist

Every row requires validated data binding, useful actions, loading/empty/error states, narrow/wide rendering, persistence and a documented verification result. A static mock does not count as completion.

| Widget | Data / existing integration | Essential interaction | Status |
|---|---|---|---|
| Passage list | bibleContent / bibleReading, parsed references | Preview/open passage, select passages, pagination where applicable | delivered; four-passages list, two-item selection, expanded comparison and reload verified; bounded to 12 items |
| Passage comparison | 2–4 exact passage targets | Stacked compact view, expanded comparison, separate analysis | delivered; exact text, compact/expanded view and destination verified |
| Translation comparison | available Bible versions and coverage | Pick supported versions, show exact same location and missing coverage | delivered; version selectors, bounded word differences, narrow layout, unavailable coverage and Escape verified |
| Concordance | strongBible / exact classic-family scope | Book filters, counts, pagination; distinguish family from lexical sense | delivered; 22-verse family, pagination, book filter, reload and contextual follow-up verified |
| Strong entry | strongLexicon and precise identity | Definition, original, transliteration, pronunciation when available | delivered; exact suffixed entry, source definition, pronunciation control and navigation verified; audible output not independently measured |
| Verse word analysis | strongBible / interlinear alignment | Select aligned word, inspect identity/morphology actually present | delivered; word selection and precise identities verified in John 15:4 and Genesis 1:1; morphology absence explicit, positive identity/morphology fixtures pass |
| Commentary comparison | commentaryReading, published sections | Attributed excerpts and exact-section opening, compare actual reads | delivered; Clarke/Barnes grouped excerpts, expanded view and exact-section opening verified |
| Dictionary articles | dictionary with work/id identity | Attributed entry preview/open, several works where available | delivered; source-group contract and Calmet live excerpt; Westphal destination verified from resource suggestions |
| Nave theme | nave | Subtopics/references and passage exploration | delivered; English widget and French/English destinations verified; source language retained in nested preview links |
| Person profile | strongLexicon entities | Editorial profile and linked passages | delivered; Adam source profile and links verified |
| Person relations | StrongEntityRelationGraph | Existing graph and certainty labels, open linked entities | delivered; expanded Adam graph, navigation to Seth and exact profile verified; source anomaly documented below |
| Place profile | entity.place | Description/references, only verified coordinates/links | delivered; Jéricho source profile, valid coordinates and route verified; finite/range guard omits unknown coordinates |
| Event timeline | timeline | Chronological order, approximate dates, event detail opening | delivered; two-event ordering, approximate/unknown date handling, expanded view and unindexed-event destination verified |
| Book presentation | existing pericope/panorama/editorial library | Actual available introduction/structure and chapter navigation | delivered; Genesis panoramas, chapter 2 navigation and honest missing-outline state verified |
| Reading-plan step | existing Firebase editorial content | Open step/passages without enrolling or recording completion | delivered; Philippians day 1 resolves and opens without enrollment or completion writes |
| Meditation | resolved editorial reading | Original text/references, separate reflection suggestions | delivered; Bonne Semence 2026-09-17 exact text, attribution, reading route and separate reflection question verified |
| Further resources | existing resource catalogs/media | Valid destinations, actual availability, no invented resource | delivered; actual media/commentary/dictionary/Nave candidates; Westphal and Nave destinations verified; missing categories supported |

## Implementation sequence

1. Inventory adapter APIs and reusable view components; record gaps before choosing wire shapes.
2. Establish public validated widget descriptors, resource-resolving UI boundary, accessible shell, shared loading/error states, transcript persistence and server events. Start with passage list end to end.
3. Passage comparison, translation comparison, concordance and verse analysis. Verify exact texts and pagination.
4. Strong/dictionary/Nave/commentary widgets and comparisons, with provenance and existing preview integration.
5. People/relations/places/events/book overview widgets using available editorial resources.
6. Plan/meditation/further-resource widgets without personal data or implicit writes.
7. Natural-language activation in the private service, current-request routing, streamed updates and contextual follow-ups. Keep descriptors and evidence out of unnecessary repeated prompt history.
8. Whole-flow QA in the real web app, across themes and widths. Validate links, refresh, context switch, cancellation, empty resources, errors and scope labels. Review the checklist before marking the goal complete.

## Initial inventory

The app ResourceAccessRegistry already provides bibleContent, bibleReading, bibleSearch, strongLexicon, strongBible, interlinearBible, dictionary, nave, timeline, commentaryReading and commentary. Plans/meditations are Firebase editorial content and are not part of that registry. ReferencePreviewHost already owns the shared click-to-preview UI. The assistant currently persists text, sources, tool events and routing snapshots; it has no widget protocol yet. Current backend resource tools cover only a subset of all these adapters, so new widgets must not imply retrieval capabilities that do not yet exist.

## Completion evidence

Record each delivered widget's source files, fixture tests, live smoke and material limitations here as work advances. Keep prompts, provider policy and detailed evaluations in the private repository. Do not mark this goal complete while any row remains pending without an explicitly accepted scope change.


## First implementation evidence — 2026-09-17

- Public validated passage-widget descriptors and SSE/storage integration added; maximum 12 list items / 4 comparison items, bounded ranges and version IDs, same-location invariant for translation comparisons.
- Exact texts load through ResourceAccessRegistry.bibleContent with per-version query caching; missing verses are explicit errors. Comparison modal uses existing Radix dialog primitives with theme/sans typography and external-open icons. The enlarged view closes before preview/navigation.
- Private present_study_widget tool now reads requested exact passages before returning evidence to Gloo. Premature model-supplied analysis is discarded; the final response can analyze retrieved text. Production first-slice deployment: 6f632b2b-f216-4bd5-a21f-f87b0c16a94d.
- Browser smoke: Jacques 2:17 / Éphésiens 2:8–9 compact and expanded side-by-side, exact texts, corrected single-verse label; opening Jacques navigated to book=59/chapter=2/verse=17 and closed expanded view. Second natural request displayed Jean 3:16 in LSG and KJV with real bilingual text. This does not prove all 17 widgets complete.
- Unit checks cover invalid widget shapes, missing verses, exact-source loading and persisted ordered-reference memory. Typechecks and web export passed during this tranche; full final validation remains required after remaining widgets.
- Remaining next actions: list interaction smoke, complete translation version controls/difference presentation, then implement concordance and lexical widgets. Keep all original pending rows in scope.


## Lexical tranche evidence — 2026-09-17

- Added validated strong_entry/concordance widget descriptors, dispatcher, theme-styled Strong entry and concordance components. Uses existing StrongEditorialHtml and ListenToStrong, exact lexicon loading, StrongBible counts/pages, app passage preview and pagination without new model calls.
- Existing successful server resource reads emit these widgets automatically. Classic concordance explicitly records H7050 scope; suffix identities cannot be represented as a classic family. Failed reads emit no widget.
- Live Strong smoke exposed Gloo passing H7050A with kind=strong. Added explicit INVALID_LEXICAL_KIND recovery rather than allowing an incoherent widget; retries successfully read/display H7050A. Regression covered privately. Source text and scope remain distinct.
- Browser verified original/transliteration/gloss/definition and audio/open controls, concordance count 22, expansion from 5 to 10 verses, filter Zacharie -> Zacharie 9:15 and count 1. Reload preserved both descriptors and reloaded real data. A development hot refresh interrupted the first concordance answer during instrumentation cleanup; a fresh post-deploy completion is being checked separately.
- Latest lexical deployment: 194c426c-31da-486d-91e3-fe4897365a40. Frontend targeted tests reached 38; private tests reached 29 passing with one optional integration skipped. Typecheck/lint/export passed before final polish. Goal remains active for all remaining rows, including richer translation controls and word analysis.

A fresh post-deploy concordance answer completed normally and rendered the widget (22 exact distinct-verse count, next-page action). Its generated summary incorrectly attached A/B sense labels despite the widget making no such claim. Server concordance evidence/prompt now explicitly prohibit guessing suffix-to-sense mappings from family results; a fresh semantic recheck remains pending. Do not treat correct UI/data loading as proof of model interpretation accuracy.


## Editorial and word-analysis tranche — 2026-09-17

- Word-analysis descriptor validates a single verse; private server reads both text and Strong alignment and refuses revision/hash mismatches. UI uses buildCanonicalStrongVerseRuns, selectable identities and morphology filtered to the selected identity. Existing Strong widget renders the chosen entry. No morphology is invented when absent.
- Commentaries and dictionary widgets group successful full reads by kind, with stable widget ID, attributed source snapshots and existing source previews/routes. Large view uses the same comparison shell. Source labels now format canonical book numbers as human Bible references.
- Nave widget reuses ResourcePreviewContent, preserving subtopics and internal references. Nave route/tab language overrides were added to keep the explicit source language when opening the full entry; global resource preferences are not mutated.
- Live smoke: Clarke+Barnes Jean 15:4 generated a single two-column source group; Barnes destination returned matching content after reload (an earlier temporary unavailable state was observed, cause not proven). Jean 15:4 word selection Demeurez resolved G3306, correctly reported absent morphology and loaded its definition. Nave Patience EN and Calmet Patience both rendered; model explicitly stated Bost absent from its search results. Full Nave route retained language=en and English source text; full dictionary route opened calmet entryId=3653.
- Initial server deployment d93ac5e2-183d-4679-853f-b606b70a6144. Public tests 39 passing, private tests 31 passing / one optional skipped. Typecheck/lint/export passed during the tranche. All remaining rows and incomplete QA qualifiers remain in scope.
- Next: person/place/relationship and timeline widgets, plus book/plan/meditation/further-resource widgets; revisit translation controls and cross-theme/width comprehensive QA before completion.


## Entity and timeline tranche — 2026-09-17

- Added reference-family routing and bounded search/read tools in the private API. Entity searches resolve at most four matching lexical entries into actual entity identifiers. Timeline keyword search combines up to three term searches (100 results per term), ranks shared matches and returns eight candidates. Reads verify returned identity and emit widgets only on success.
- Added person/place/relations widgets reusing StrongEntitySummaryCard and StrongEntityRelationGraph. Resource language is carried into profiles/graph reads. Place map links are constructed only for finite in-range coordinates from the resource. Root relationship details and profile action name their subject to avoid confusing a graph child with its original root.
- Timeline events group across reads. Numeric timeline geometry orders events where available; explicit editorial BC/AD dates supply positions for events missing from the old bundled index. Unsupported narrative dates stay unknown. Added EventScreen fallback to resource details so such events can actually open, with their source date label (not a fabricated year).
- Live tests: Adam profile + family graph; expanded graph navigated Adam→Seth and opened Seth@Gen.4.25-Luk. Jéricho loaded source coordinates and opened Jericho@Num.22.1-Heb. Initial model wrongly used passage-list presentation for a frise; instructions now require timeline-resource tools. Initial phrase search missed « naissance Jésus »; token search regression fixed it. Final identical natural request generated Incarnation + Resurrection, in correct order after reload, and the Incarnation detail opened successfully.
- Source limitation: editorial Adam data includes an Eve-as-sister relation. The widget faithfully labels source provenance; server instructions now forbid inventing explanations to justify atypical/contradictory relations. Data curation is not silently performed by the assistant.
- Latest reference deployment: 8eed0420-7d71-4498-8ac8-9776cb84f63e. UI regression suite reached 46 passing; TypeScript/export passed during this tranche. Additional final cross-theme/width and missing-data verification remains open.
- Remaining four widget implementations: book presentation, reading-plan step, meditation and further resources. Also complete pending version-selection/difference controls, list smoke and comprehensive QA from earlier rows before marking the goal complete.

## Final implementation and verification — 2026-09-17

All 17 requested presentations are implemented. Historical “pending” statements above describe earlier tranches; the delivery table and this section are the current status.

- Added book, public editorial reading/meditation and further-resource descriptors, server reads and client renderers. Public Firebase catalog reads are anonymous and fixed to the plans/plan-sections collections; private tests verify field projection and reject arbitrary paths. The app resolves reading content without enrollment or progress updates.
- Live book request showed all three Genesis introduction videos. The first panorama opened successfully even though it is outside the former media library index. Chapter 2 opened the matching Bible route. LSG has no detailed outline in the current data, so the card reports that gap.
- “Lire Philippiens” day 1 opened `/plan-slice` with the correct IDs. Bonne Semence 2026-09-17 opened the exact meditation. A final fresh response showed only the requested reflection question alongside the source widget, without reproducing the source text in assistant prose.
- Resource suggestions returned actual French media, Nave Patience, Clarke/Barnes and Calmet/Westphal entries. Westphal entry 10591 and French Nave Patience opened successfully. Suggestions are visibly distinguished from documents read.
- Translation controls load exact texts without a model call. LSG/DBY differences were inspected at full width and 390×844. BHS for John 3:16 produced an explicit missing-coverage state, and selecting DBY recovered. Lexical highlighting preserves exact text and makes no semantic-equivalence claim. Exploration controls do not rewrite prior assistant prose or persist over a reload; the original descriptor remains the conversation record.
- Four-passages list selection reduced the expanded view to exactly the chosen two passages. Reload retained the four original references and text loading. Stable ID upserts preserve card order when grouped source reads arrive; interruption regression coverage retains already-received cards without treating the answer as complete.
- Shared shells, lexical selection and source text were inspected in light/dark themes. Narrow comparison stacks properly and Escape closes the expanded dialog. Original day theme and browser viewport were restored. Source HTML now supports explicit typography, so assistant Strong/Nave/entity excerpts use sans-serif instead of inheriting the reading font. Reading text contrast was corrected.
- Validation: scoped UI/resource/navigation suites, Expo and root TypeScript checks, root build, production web export, targeted ESLint, style guard and Resource architecture passed. Private API tests pass with one optional integration test skipped. Contracts and stream/source/widget parsers are byte-identical across the public contract and private mirrors. React Doctor reports three existing compiler errors in the legacy StudyAssistantScreen, outside these new widgets; no new widget error was reported.

### Data and product limits

- Source data controls what can be shown: no fabricated outline, morphology, map coordinate or timeline date. The live BHG word-analysis request was unavailable; the response explicitly offered LSG instead. LSG examples had no occurrence morphology. Positive morphology associations are covered by source helper fixtures, not claimed as live BHG coverage.
- Source quality is unchanged. The Adam dataset includes Eve as both spouse and sister; source attribution/certainty remains visible. General AI explanations may still overinterpret a word; the exact lexical widget is separate source evidence, not a guarantee about generated prose.
- Pronunciation uses the existing shared audio player and third-party audio assets. Its action was exercised without an app error; acoustic output was not independently measured.
- A widget is selected by the assistant according to the request and available tools; an ordinary explanation need not contain one. Automatic comparisons/word exploration are described in the private policy.
- UI is web-first. No native widget UI, cloud conversation synchronization, personal writes, new subscription policy or automatic commits were added by this goal.

Final activation smoke: the natural request “J’aimerais explorer les mots de Jean 15:4 pour comprendre ce que signifie demeurer” produced the interactive word-analysis widget directly, without naming a tool or component. Final private deployment: `490ecf72-776d-4bb5-8e59-65535a98251d`. Final targeted suite: **119 tests passed / 26 suites**; private suite: **35 passed / 1 optional skip**. Types, targeted lint and final web export passed. Goal completed; changes remain uncommitted in both repositories.
