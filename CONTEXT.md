# Bible Strong Context

Bible Strong is a mobile Bible study application for French-speaking users first, with English support and original-language resources. The product goal is not only reading Bible text; it is an integrated study workspace where the same passage can connect to Strong's definitions, interlinear text, cross references, topical references, personal notes, highlights, links, studies, audio, and reading plans.

## Domain Purpose

The app helps a user move from a Bible passage to surrounding study material while preserving their own study state offline and, when authenticated, syncing it to Firestore.

Core user activities:

- Read Bible chapters across many translations.
- Compare translations and original-language resources.
- Select verses or words and attach highlights, notes, tags, links, bookmarks, and study references.
- Search text and navigate to matching passages or study objects.
- Download Bible/resource databases for offline use.
- Track reading plans and study documents.
- Listen through TTS or remote audio.

## Product Surfaces

| Surface | Meaning |
|---|---|
| App switcher | The root tab/group workspace. Users can keep multiple Bible/search/resource tabs open. |
| Bible view | Main reading surface. Open with the book icon in the bottom tab nav. |
| Selected verses modal | Bottom sheet shown after selecting verse text; exposes Annoter, Etudier, and Partager actions. |
| Annotation mode / Mode libre | Word-level annotation mode for selecting and styling individual words or ranges. |
| Downloads | Resource installation screen for Bible versions and local databases. |
| Study editor | User-authored rich-text study documents. |
| Search | Global/local search that returns openable Bible passages and study objects such as Strong entries, Nave topics, dictionary entries, notes, and studies. |

## Core Domain Terms

| Term | Definition | Main code |
|---|---|---|
| Bible version | A translation or source text identified by a code such as `LSG`, `KJV`, `BHS`, `SBLGNT`. | `src/helpers/bibleVersions.ts` |
| Bible version language | The language in which a Bible version presents its primary readable text, such as French, English, Hebrew, Greek, or Latin. It is independent from whether the version is a translation, original-language text, or interlinear resource. | Bible version metadata |
| Bible resource kind | The nature of a Bible version: translation, original-language text, or interlinear resource. | Bible version metadata |
| Translation reading profile | The single curated reading style assigned to a translated Bible version for discovery: word for word, balanced, thought for thought, or paraphrase. A translation remains explicitly unclassified when no reliable source or editorial decision supports an assignment. | Bible version metadata |
| Bible version capability | An independently filterable feature offered by a Bible version, such as Strong data or audio. A capability is neither a language nor a translation approach. | Bible version metadata |
| Bible version grouping | The mutually exclusive presentation used to organize the Bible version catalog: one alphabetical list, language sections, or translation-reading-profile sections. Versions are ordered alphabetically inside every section; style grouping places original, interlinear, and unclassified versions in an Other section; the choice is shared by all selectors and retained on the device without account synchronization. | Bible version selector |
| Verse key | Canonical verse identifier used for user data, generally `book-chapter-verse` such as `1-27-2`. | `src/redux/modules/user.ts`, `src/redux/selectors/bible.ts` |
| Versification | Declared book/chapter/verse numbering system used by a Bible version. The initial online-resource design preserves the app's current numeric location model and does not automatically convert between versifications. | Bible version metadata |
| Bible canon | Declared set and ordering of books covered by a Bible version. Published coverage records what the application can actually open. | Bible version metadata |
| Selected verses | The current verse selection in Bible view, used to create highlights, notes, tags, links, bookmarks, study entries, or shares. | `src/features/bible/SelectedVersesModal/` |
| Highlight | Verse-level visual mark stored in Redux/Firestore under `user.bible.highlights`. | `src/redux/modules/user.ts`, `src/features/bible/ColorCirclesBar.tsx` |
| Word annotation | Word/range-level mark created in Mode libre and stored under `user.bible.wordAnnotations`. | `src/features/bible/hooks/useAnnotationMode.ts`, `src/features/bible/BibleDOM/AnnotationMode/` |
| Note | User text that can exist independently and can be connected to verses or other entities through relations. | `src/features/bible/BibleNoteModal.tsx`, `src/features/notes/` |
| Annotation note | Note that belongs to one word annotation and follows that annotation's lifecycle. | `src/features/bible/AnnotationNoteModal.tsx` |
| Tag | Shared organization object that can reference highlights, annotations, notes, links, and studies. | `src/common/UnifiedTagsModal.tsx`, `src/redux/modules/user/tags.ts` |
| Entity chip list | Compact chip row showing study associations attached to one object, such as tags and a relation count. | `src/common/EntityChipList.tsx` |
| Bookmark | Named marker for one Bible location. | `src/features/bookmarks/`, `src/features/bookmarks/BookmarkModal.tsx` |
| Link | User URL that can exist independently and can be connected to verses or other entities through relations. | `src/features/bible/BibleLinkModal.tsx` |
| Relation | Binary edge between two relation endpoints that can be opened inside Bible Strong. | `src/features/studyRelations/` |
| System relation | Relation implied by a feature action, such as connecting a note or link to a verse. | `src/features/studyRelations/` |
| Manual relation | Relation intentionally created by the user to express a study connection between two endpoints. | `src/features/studyRelations/` |
| Relation endpoint | Openable study object that can participate in a relation, such as a verse, note, study, Strong entry, Nave topic, dictionary word, word, or external link. | `src/features/studyRelations/` |
| Relation target picker | Surface for choosing the target endpoint of a study relation through unified search or by browsing a specific endpoint type. | Planned |
| Relation type | Meaning assigned to a relation, such as linked, references, explains, contrasts, mentions, annotates, or external link. | `src/features/studyRelations/` |
| Relation display | Bible reading setting that controls whether verse relations appear as a grouped icon at the start of their range or as short inline chips at the end of their range. | `src/features/bible/BibleDOM/` |
| Study | Rich text document authored by the user; can be tagged and can receive verse references. | `src/features/studies/`, `src/redux/modules/user.ts` |
| Reading plan | Structured sequence of Bible readings, meditations, media, or teaching slices followed by the user. | `src/features/plans/`, `src/redux/modules/plan.ts` |
| Plan slice | One reading unit inside a reading plan; it can contain Bible text, meditation text, image, video, or a chapter/verse reference. | `src/features/plans/PlanSliceScreen/` |
| Plan tab | App tab anchored to one reading plan, with a plan slice optionally opened inside the tab. | `src/features/plans/`, `src/state/tabs.ts` |
| Passage media work | One language-independent editorial resource concept that can have independently hosted localized editions, such as a BibleProject book overview, passage commentary, theme, or word study. | Passage media catalog |
| Passage media edition | One language-specific hosted realization of a Passage media work, identified independently from its provider URL or video ID. French and English editions are alternatives selected by application language, never runtime fallbacks for one another. | Passage media catalog |
| Passage media anchor | A reviewed relationship that makes one Passage media work discoverable from a Bible book, passage, verse range, Strong entry, or related study context, with explicit placement and relevance. | Passage media catalog |
| Strong | Hebrew/Greek lexical identifiers resolved by the modular core lexicon, with optional LSJ/TIPNR enrichments and version-specific concordance sidecars. Standalone Strong pages are owned by the `/strong` route hierarchy rather than Explore. | `app/strong/`, `src/features/resources/strongLexiconAccess.ts`, `src/helpers/strongLexiconModules.ts`, `src/helpers/strongBibleSidecar.ts` |
| Strong verse context | Optional Bible passage, selected surface word, and contextual morphology carried when a Strong entry is opened from Bible reading. It is absent when the entry is opened without a source passage and is never inferred from an example verse. | Strong selection and Strong detail surfaces |
| Biblical entity | Optional real-world referent linked to a Strong entry, categorized as a person, place, group, or another typed entity such as supernatural being, time, musical concept, title, star, or language. | `src/features/resources/strongLexiconAccess.ts`, Strong lexicon entities module |
| Detailed Greek dictionary | Optional TFLSJ classical Greek notice attached to one Greek Strong entry. It is the only user-facing content of the technically named Strong lexicon `resources` module; the technical module name is not a product category. | Strong lexicon resources module |
| Interlinear | Original-language verse display with lexical/translation alignment. BHG is the canonical readable Hebrew/Aramaic and Greek Bible; optional localized interlinear indexes add glosses, transliteration, morphology and lexical identities without duplicating its text. | `src/helpers/interlinearBibleSidecar.ts`, `src/features/bible/BibleDOM/StructuredInterlinearVerse.tsx` |
| Nave | Nave's topical Bible resource. | `src/features/nave/`, `src/helpers/loadNaveItem.ts` |
| Resource database | Downloaded SQLite/JSON file used by study features. | `src/helpers/databases.ts`, `src/helpers/databaseTypes.ts` |
| Offline copy | Complete resource content deliberately installed on the device for durable use without a network connection. An offline copy is a local source, not a query cache. | `src/features/resources/`, `src/features/settings/DownloadsScreen.tsx` |
| Initial offline setup | Optional, dismissible onboarding step that can build the device's first Offline-copy selection. It may suggest the language-specific default Bible and thematic Offline setup folders, but the app remains usable without completing a download. | Onboarding and resource installation |
| Default Bible | Language-specific initial reader choice: LSG for French and KJV for English. It is a navigation preference, not a required Offline copy; it remains selectable online when supported and may be removed from local storage. | Bible reader initialization and settings |
| Offline setup folder | Ephemeral thematic catalog shown during Initial offline setup, such as reading, word understanding, Bible exploration, or original languages. A folder may suggest defaults but lets the user select individual additional Offline copies; the folder itself is never installed or managed after onboarding. | Initial offline setup |
| Initial offline selection | Optional mutable onboarding draft composed of the Offline copies selected across Offline setup folders. Suggested defaults are editable. The selection is deduplicated before its missing copies enter the download queue, then ceases to exist as a product object. | Initial offline setup |
| Offline-copy metadata | Locally retained publication identity for an installed Offline copy: Resource revision, checksum, artifact schema version, installation time, and resource-specific counts where useful. | Resource installation layer |
| Query cache | Temporary reuse of resource query results managed by the query layer. The initial online-resource implementation keeps this cache in memory; persistent partial caching is a separate future capability. | Query layer |
| Resource identity | Durable identifier of one independently distributable editorial resource, including every dimension that changes its publication lifecycle such as Bible version, resource kind, language, or sidecar role. | Resource publication pipeline and Resource catalog |
| Resource revision | Immutable, content-derived identifier of one published edition of a Resource identity. The same revision identifies its canonical Online content and downloadable Offline copy; older revisions are not retained in the live resource database. | Resource publication pipeline |
| Resource publication bundle | Versioned, validated handoff produced by Bible Lexicon Maker for exactly one Resource identity and Resource revision. It contains a canonical import representation, the matching Offline-copy artifact, manifest, provenance, rights, and integrity metadata. | Bible Lexicon Maker and Resource publication pipeline |
| Resource catalog | Minimal server manifest declaring the current Resource revision, online availability, offline-artifact location, and integrity metadata of each independently distributable resource identity. Product labels and initial adapter support remain application code. | Resource publication pipeline |
| Resource delivery capabilities | Per-resource or per-version declaration of whether content can be read through remote Online access and whether a complete Offline copy can be downloaded. These capabilities are independent. | Resource catalog |
| Resource distribution rights | Structured provenance, rights-holder, terms reference, attribution, review date, and allowed Online/Offline delivery modes for an editorial resource. It informs publication controls but does not replace legal review. | Canonical resource metadata |
| Resource availability | User-relevant state with independent Online-access and Offline-copy dimensions, plus loading, update, integrity, and failure information where relevant. It does not expose technical source details such as SQLite, HTTP, or query cache. | Resource selectors, management surfaces, and resource viewers |
| Resource access error | Structured failure classified as unavailable offline, not installed, unsupported, not found, corrupt or incomplete local copy, or remote service failure. It supports source fallback and an actionable viewer state without exposing raw storage or network errors. | `src/features/resources/` |
| Resource domain contract | Storage-independent request and result model exposed by one Resource access capability. Local SQLite and remote HTTP adapters translate their representations into the same contract. | `src/features/resources/` |
| Resource domain API | Versioned REST boundary that serves canonical editorial-resource operations without exposing PostgreSQL schemas or historical mobile types. Its contract version is independent from Resource revisions. | Resource service |
| Resource access | Domain interface used by app surfaces to read Bible/resource content without knowing whether the data comes from local storage, partial cache, or a future remote adapter. | `src/features/resources/` |
| Publication parity | Domain-level equivalence between the canonical Online content and matching Offline-copy artifact of one Resource revision. Storage formats may differ, but visible content, identities, coverage, editorial data, and declared counts may not. | Resource publication pipeline |
| Search parity | Compatibility between online and offline search at the level of query meaning, filters, pagination, and result contract. It does not require identical relevance scores or result ordering from PostgreSQL and SQLite FTS5. | Bible and resource search |
| Tab group | A group of app tabs persisted through Jotai/MMKV and optionally synced. | `src/state/tabs.ts`, `src/state/tabGroups.ts` |
| Guest session | A period without an authenticated account during which locally created study data belongs to the device user rather than to a cloud account. A guest session may begin on a fresh installation or after an account logout has cleared the previous account's state. | Authentication and persistence |
| Guest data | Account-eligible study data created during the current guest session. It excludes data retained from an authenticated account and device-owned resources or caches. | Redux/Jotai persistence |
| Account-entry classification | The ownership decision made when authentication begins an account session: genuinely new account, existing account, provider link, restored session, or unknown. Unknown is an unresolved state, not evidence that the account is existing. | Authentication and synchronization |
| Account-eligible guest data | Guest data whose domain type already participates in account synchronization. Guest adoption does not turn previously device-owned state into account-owned state. | Authentication and synchronization |
| Guest adoption | The one-time ownership transition that assigns account-eligible Guest data to a genuinely new account before normal account hydration begins. | Authentication and synchronization |

## Domain Relationships

- A **Reading plan** contains one or more **Plan slices**.
- A **Plan tab** is anchored to exactly one followed **Reading plan** and may display one active **Plan slice**.
- Leaving a **Plan slice** inside a **Plan tab** returns to the parent **Reading plan**.
- Any **Plan slice** can be the active content of a **Plan tab**, regardless of whether it contains Bible text, meditation text, image, video, chapter, or verse content.
- A **Passage media work** can have multiple localized **Passage media editions** and multiple **Passage media anchors**.
- A **Passage media anchor** describes where an editorial resource is relevant; the resource category describes what the content is. Book, passage, verse, and Strong are anchor targets rather than media categories.
- A thematic **Passage media work** has exactly one primary **Passage media anchor** for automatic Bible view placement; its related anchors support discovery without creating additional automatic placements.
- If the followed **Reading plan** no longer exists, its **Plan tab** has no reading content to recover.
- A **Tag** groups user study objects by theme or category.
- A **Relation** connects exactly two **Relation endpoints**.
- A **Link** opens an external URL, while a **Relation** opens another object inside Bible Strong.
- An **Annotation note** belongs to its **Word annotation** and is not surfaced as a passage-level **Relation** by default.
- A **Bookmark**, **Highlight**, and **Tag** are not **Relation endpoints**.
- A **Relation** is binary; it never groups more than two **Relation endpoints**.
- A **Relation** is non-directional by default and only becomes directional when its relation type needs a direction.
- **Same theme** is not a **Relation type**; use **Tags** for thematic grouping.
- Every **Relation** has a **Relation type**; the default type is linked.
- A **Relation endpoint** is identified by its durable object identity and may keep a display label snapshot as fallback.
- **Relation endpoints** are the shared identity language for objects that can be opened inside Bible Strong, including Search results and Relation target selection.
- Deleting or losing access to a **Relation endpoint** does not automatically delete its **Manual relations**.
- A **Manual relation** can exist even when one of its **Relation endpoints** is not currently openable on the device.
- **Relations** are private user-owned study data and are not published with **Studies**.
- A **Manual relation** may have a short user label but does not contain long-form note text.
- A user can have at most one **Relation** for the same unordered endpoint pair and **Relation type**.
- A **Verse** relation endpoint can represent one or more selected verses in canonical order.
- A **Strong** relation endpoint is identified by original-language family and numeric Strong code, with the Strong word as its display label fallback.
- Opening a **Relation** navigates to the target endpoint; opening that target in a new tab remains an action of the target screen.
- A **Relation** is discoverable from both of its **Relation endpoints**.
- **Verse** relations are surfaced in the Bible reading surface; **Note**, **Study**, and **Strong** relations are surfaced near tags in their detail surfaces.
- A **Manual relation** can be created from selected verses, note details, study items, and Strong details.
- Relation target selection follows the app search language for Bible references and Strong codes, then adds Notes and Studies as searchable target types.
- A **Verse** relation target is a global Bible reference, not a specific Bible version rendering.
- **Verse** relation endpoints identify Bible locations, not Bible version-specific text.
- A directional **Relation** is visible from both endpoints, with active wording from the source and passive wording from the target.
- The linked and contrasts **Relation types** are non-directional; references and explains are directional.
- **Relations** live in their own user-data collection, separate from Notes, Studies, Links, Tags, and Highlights.
- **System relations** remain derived from their source object lifecycle; a **Note**, **Link**, or **Word annotation** stays the source of truth.
- **Relation display** replaces separate note and link display settings in the Bible reading surface.
- In grouped icon mode, **Relation display** surfaces verse relations at the start of their verse range.
- In inline mode, **Relation display** surfaces verse relations at the end of their verse range.
- Inline **Relation display** shows the related endpoint label by default; relation type wording is optional and disabled unless explicitly enabled.
- Grouped **Relation display** uses one stable relation icon and counts relations rather than unique target endpoints.

## Invariants

- The app is expected to work offline for already downloaded Bible/resource data.
- Parallel Bible reading resolves enriched presentation capabilities per column. A Bible without the requested Strong or interlinear capability remains readable as plain text; a capable Bible whose required enrichment fails keeps an actionable error. BHG uses its Strong presentation during Strong comparison and its detailed interlinear presentation during interlinear or reverse-interlinear comparison.
- Passage media discovery uses the application or route language strictly. A missing French edition is not replaced by an English edition, and a missing English edition is not replaced by a French edition.
- Resource access modules should preserve the offline behavior of downloaded Bible/resource data while creating seams for future remote adapters.
- No editorial resource is required to initialize or enter the app. LSG and KJV are language-specific default Bible choices, not mandatory Offline copies, and their optional Strong indexes remain separate resources.
- Initial offline setup is optional and dismissible. Every suggested Offline copy can be deselected, and the user may finish onboarding with no resource installed.
- Offline setup folders exist only to compose the Initial offline selection. After enqueueing, the application manages individual Offline copies and does not expose folder installation, folder progress, folder updates, or folder removal.
- Resource consumers use one query interface regardless of source. Resource access chooses between an installed Offline copy and remote access; the Query cache does not replace either source.
- Reading and search intentionally use different source priorities. Reading prefers a valid installed Offline copy. Search prefers the remote search service while connected and the installed local index while disconnected; a temporary remote-search failure may fall back to the local index.
- Local and remote adapters return the same Resource domain contract; SQLite rows and HTTP payload shapes do not escape their adapters.
- Resource domain contracts have a shared machine-readable definition that supports runtime validation, inferred or generated TypeScript types, and OpenAPI documentation for the REST boundary.
- Resource domain API versions describe backward-compatible HTTP contracts; Resource revisions describe content and do not create new API versions.
- The Resource domain API serves only the active Resource revision, identifies it in responses and validators such as `ETag`, and does not provide historical-revision reads.
- Resource domain API payloads use canonical DTOs rather than mobile `Verse` or PostgreSQL row types. Boundary failures use stable structured problem responses and never expose database errors.
- Online and offline search preserve Search parity without promising identical ranking between their different search engines.
- Until remote search endpoints exist for a resource, its search remains explicitly local-only; local-only search must not pretend that remote priority has already been implemented.
- Remote editorial resources and their downloadable Offline copies are derived from the same Resource revision.
- Bible Lexicon Maker owns generation and validation of a Resource publication bundle; the Resource service owns importing that bundle into its canonical database and serving it through the Resource domain API.
- Each Resource publication bundle is independently importable. Its format version is owned by Bible Lexicon Maker, and the Resource service accepts only explicitly supported versions.
- Reimporting the same Resource identity and Resource revision is a no-op when checksums match and a publication error when content differs.
- Publication parity is a blocking activation condition for every Resource revision.
- A canonical Bible import includes the complete published text, canon, Versification, coverage, and editorial presentation data even when the first Online route exposes only a subset.
- Canonical content is imported into resource-specific relational models. Only publication identity, revision, provenance, rights, and lifecycle metadata are shared across resource domains.
- Database migrations change canonical storage structure without carrying editorial content; Resource publication bundles change editorial content without redefining the database schema.
- Bible resource metadata declares its Bible canon, Versification, and published coverage. The initial system preserves the existing numeric book/chapter/verse identity and does not provide automatic cross-versification conversion.
- Resource revisions are published independently; the Resource catalog selects the active revision for each resource identity without creating one global catalogue revision.
- Neon retains only the current published Resource revision for each resource identity. A replacement may coexist temporarily in staging during publication, but older revisions are removed after activation.
- Remote editorial resources can be read without an authenticated user account; account authentication remains a concern of user-owned data rather than resource delivery.
- Online access and Offline-copy download availability are independent Resource delivery capabilities; a resource may support either or both according to licensing and rollout constraints.
- Resource delivery capabilities must agree with the resource's structured Resource distribution rights before publication.
- The Resource catalog is publication metadata, not a remote feature-flag system. Initial remote-adapter support and stable product metadata remain in application code.
- An installed Offline copy remains the preferred source when a newer Resource revision is available. The update is explicit; content does not switch between local and remote revisions according to connectivity.
- Every installed Offline copy retains Offline-copy metadata so the app can detect updates, validate integrity, and interpret the artifact schema without inferring identity only from file existence.
- A recoverable failure from an installed Offline copy, such as corruption or incomplete content, may fall back automatically to Online access. A genuine domain `not found` result is not reclassified as local corruption.
- Normal resource consumption does not expose whether data came from SQLite, HTTP, or Query cache. A selector may indicate whether an Offline copy is installed, but it does not resolve or intercept content loading.
- Selecting a resource opens its normal viewer. The viewer requests content through the query and Resource access layers, then renders either the content or an actionable unavailable state such as offering an Offline-copy download.
- Resources remain visible and selectable in catalogs even when they may not currently load. Raw network and storage errors are translated into viewer states rather than pre-emptively removing or blocking catalog choices.
- User-owned Bible data lives primarily in Redux state and is persisted locally through MMKV/redux-persist.
- Authenticated user data can sync with Firestore; changes to sync semantics are sensitive.
- Logging out ends the authenticated account session and clears its account-owned local state; any study data created afterward belongs to a new guest session.
- A genuinely new account may adopt eligible guest data from the current guest session even when another account previously used the device.
- Entering an existing account never adopts guest data; the existing account's cloud data becomes authoritative without requiring user confirmation.
- While account-entry classification is unknown, guest data remains visible and neither guest adoption nor remote account hydration may begin.
- A genuinely new account is established only by the credential operation that creates or first authenticates it. Restored authentication state, account timestamps, and empty remote data do not prove that an account is new.
- Guest adoption preserves stable identifiers for user-authored source entities and Manual relations. System relations and derived relation indexes are rebuilt from their adopted sources rather than adopted independently.
- Guest adoption follows the app's existing account-sync boundary for preferences: synchronized settings are eligible, while settings and state that are currently device-owned remain device-owned.
- Guest adoption follows the existing sync contracts for Reading plans and Tab groups: synchronized plan state and workspace content are eligible, while downloaded content, caches, previews, and transient navigation state remain device-owned.
- Creating a Study requires an authenticated account. A Study created through an unauthenticated UI path is invalid guest state and is not part of the guest-adoption contract.
- A pending Guest adoption is permanently bound to the UID of the account that received it. It may resume after logout or restart only when that same account returns, and it can never be reassigned to another account.
- Email verification does not determine Guest adoption eligibility. Adoption begins when account creation is confirmed and remains pending if remote authorization requires later verification.
- Account-eligible Guest data comprises guest-creatable types already owned by account sync: highlights and custom colors, notes, bookmarks, tags and their tagged resource references, links, word annotations and annotation notes, Manual relations, synchronized settings, followed-plan progress, and synchronized Tab groups. Studies, System relations, derived indexes, downloads, caches, technical notification state, changelog state, and transient UI state are excluded.
- Bible/resource database files are language-aware: many resources are language-specific, while some are shared.
- The reading surface is WebView/DOM-backed; native UI often orchestrates state and bottom sheets around it.
- React Compiler is enabled. Do not add `useMemo`, `useCallback`, or `memo()` unless there is a specific compiler-compatible reason already established in this repo.

## Agent Working Agreements

- Read this file before changing product behavior.
- Read `docs/index.md` for the documentation map.
- Read `docs/agents/sensitive-areas.md` before touching auth, sync, storage, backups, migrations, native config, releases, or destructive flows.
- Use the domain terms in this file in issues, plans, tests, and PR descriptions.
- When a new domain decision is made, add an ADR under `docs/adr/`.
