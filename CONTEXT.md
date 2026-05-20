# Bible Strong Context

Bible Strong is a mobile Bible study application for French-speaking users first, with English support and original-language resources. The product goal is not only reading Bible text; it is an integrated study workspace where the same passage can connect to Strong's definitions, interlinear text, cross references, topical references, personal notes, highlights, links, studies, audio, and reading plans.

## Domain Purpose

The app helps a user move from a Bible passage to surrounding study material while preserving their own study state offline and, when authenticated, syncing it to Firestore.

Core user activities:

- Read Bible chapters across many translations.
- Compare translations and original-language resources.
- Select verses or words and attach highlights, notes, tags, links, bookmarks, and study references.
- Search text and navigate back into the reading surface.
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
| Search | Global/local text search that returns passages and opens them in Bible view. |

## Core Domain Terms

| Term | Definition | Main code |
|---|---|---|
| Bible version | A translation or source text identified by a code such as `LSG`, `KJV`, `BHS`, `SBLGNT`. | `src/helpers/bibleVersions.ts` |
| Verse key | Canonical verse identifier used for user data, generally `book-chapter-verse` such as `1-27-2`. | `src/redux/modules/user.ts`, `src/redux/selectors/bible.ts` |
| Selected verses | The current verse selection in Bible view, used to create highlights, notes, tags, links, bookmarks, study entries, or shares. | `src/features/bible/SelectedVersesModal/` |
| Highlight | Verse-level visual mark stored in Redux/Firestore under `user.bible.highlights`. | `src/redux/modules/user.ts`, `src/features/bible/ColorCirclesBar.tsx` |
| Word annotation | Word/range-level mark created in Mode libre and stored under `user.bible.wordAnnotations`. | `src/features/bible/hooks/useAnnotationMode.ts`, `src/features/bible/BibleDOM/AnnotationMode/` |
| Note | User text attached to verses or annotations. | `src/features/bible/BibleNoteModal.tsx`, `src/features/notes/` |
| Tag | Shared organization object that can reference highlights, annotations, notes, links, and studies. | `src/common/UnifiedTagsModal.tsx`, `src/redux/modules/user/tags.ts` |
| Bookmark | Named marker for one Bible location. | `src/features/bookmarks/`, `src/features/bookmarks/BookmarkModal.tsx` |
| Link | User URL attached to a verse selection. | `src/features/bible/BibleLinkModal.tsx` |
| Study | Rich text document authored by the user; can be tagged and can receive verse references. | `src/features/studies/`, `src/redux/modules/user.ts` |
| Reading plan | Structured sequence of Bible readings, meditations, media, or teaching slices followed by the user. | `src/features/plans/`, `src/redux/modules/plan.ts` |
| Plan slice | One reading unit inside a reading plan; it can contain Bible text, meditation text, image, video, or a chapter/verse reference. | `src/features/plans/PlanSliceScreen/` |
| Plan tab | App tab anchored to one reading plan, with a plan slice optionally opened inside the tab. | `src/features/plans/`, `src/state/tabs.ts` |
| Strong | Hebrew/Greek lexical identifiers and concordance resources. | `src/features/bible/Strong*`, `src/helpers/loadStrong*` |
| Interlinear | Original-language verse display with lexical/translation alignment. | `src/helpers/loadInterlineaireChapter.ts`, `src/features/bible/BibleDOM/InterlinearVerse*` |
| Nave | Nave's topical Bible resource. | `src/features/nave/`, `src/helpers/loadNaveItem.ts` |
| Resource database | Downloaded SQLite/JSON file used by study features. | `src/helpers/databases.ts`, `src/helpers/databaseTypes.ts` |
| Tab group | A group of app tabs persisted through Jotai/MMKV and optionally synced. | `src/state/tabs.ts`, `src/state/tabGroups.ts` |

## Domain Relationships

- A **Reading plan** contains one or more **Plan slices**.
- A **Plan tab** is anchored to exactly one followed **Reading plan** and may display one active **Plan slice**.
- Leaving a **Plan slice** inside a **Plan tab** returns to the parent **Reading plan**.
- Any **Plan slice** can be the active content of a **Plan tab**, regardless of whether it contains Bible text, meditation text, image, video, chapter, or verse content.
- If the followed **Reading plan** no longer exists, its **Plan tab** has no reading content to recover.

## Invariants

- The app is expected to work offline for already downloaded Bible/resource data.
- User-owned Bible data lives primarily in Redux state and is persisted locally through MMKV/redux-persist.
- Authenticated user data can sync with Firestore; changes to sync semantics are sensitive.
- Bible/resource database files are language-aware: many resources are language-specific, while some are shared.
- The reading surface is WebView/DOM-backed; native UI often orchestrates state and bottom sheets around it.
- React Compiler is enabled. Do not add `useMemo`, `useCallback`, or `memo()` unless there is a specific compiler-compatible reason already established in this repo.

## Agent Working Agreements

- Read this file before changing product behavior.
- Read `docs/index.md` for the documentation map.
- Read `docs/agents/sensitive-areas.md` before touching auth, sync, storage, backups, migrations, native config, releases, or destructive flows.
- Use the domain terms in this file in issues, plans, tests, and PR descriptions.
- When a new domain decision is made, add an ADR under `docs/adr/`.
