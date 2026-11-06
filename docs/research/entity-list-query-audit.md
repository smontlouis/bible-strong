# User-data entity list query audit

## Scope

This audit covers the existing list surfaces selected by the Wayfinder map:

- Tags
- Notes
- Studies
- Links (global list only)
- Highlights mixed with word annotations
- Dedicated word annotations

Tag detail, bookmarks, study relations, history, reading plans, downloaded resources, settings,
and contextual per-verse lists are outside this effort.

## Executive findings

1. Notes, Studies, and Links already share a useful search seam in
   `src/features/search/shared/`: entity adapters produce `SearchEntityResult`, and
   `searchWithMatches` applies the same accent-insensitive Fuse semantics to title and
   description. Study rich text is already flattened with `deltaToPlainText`.
2. Page-level query execution is not shared. Each screen currently owns local React state,
   filters arrays directly, and sorts mutable arrays in render or effects. None of the in-scope
   page query states is persisted.
3. `atomWithAsyncStorage` is the established MMKV-backed persistence primitive and already
   supports schema migration. `searchFiltersAtom` demonstrates persisted, migratable filter
   state, but the global search text itself is not persisted there.
4. `FiltersHeader` is the existing filter-shell seam, but its interface only supports a static
   row (`label`, `value`, `onPress`) and a Boolean active state. It can host a Search action but
   does not own nested-sheet navigation, query editing, result computation, or persistence.
5. Highlights and annotations have materially different identities. A highlight is keyed by a
   canonical verse key and has no Bible version; a word annotation owns a version and one or
   more verse ranges. Any shared ordering must normalize both to canonical verse positions.
6. The mixed Highlights screen silently truncates each source to its 100 newest raw entries and
   renders the result in a non-virtualized `ScrollView`. Querying must happen before any display
   limit, or valid filtered items can remain unreachable.
7. Existing collection sizes are unbounded in the durable models. Tags uses `LegendList`; the
   other screens use `FlatList`, except mixed Highlights. In-memory filtering is appropriate as
   a first implementation, but expensive relation scans and rich-text conversion should be
   concentrated behind memoized selectors/pure query modules and measured with large fixtures.

## Surface matrix

| Surface | Durable source and item identity | Current discovery behavior | Existing limit / rendering | Important constraints |
|---|---|---|---|---|
| Tags | `user.bible.tags`; tag `id`; name plus reverse indexes for nine taggable entity categories | Fuzzy name search through `useFuzzy`; A–Z via `sortedTagsSelector`; no filter sheet or persistence | Unbounded `LegendList` | Total count must use live entities, not blindly sum reverse-index keys, because stale/orphan references are possible. `makeTagDataSelector` already filters missing entities but is instantiated/read per row. |
| Notes | `user.bible.notes`; record key is canonical ID; `date`, title, description, tags | Tag filter; newest first; no page search or persistence | Unbounded virtualized list | Annotation notes use `annotation:<id>` keys. References are derived from annotations or system relations but are out of the requested query dimensions. |
| Studies | `user.bible.studies`; stored key and `study.id`; `created_at`, `modified_at`, rich content, optional `published`, tags | Tag filter; modified newest first; no page search or persistence | Unbounded multi-column `FlatList` | Missing `published` is existing legacy/default data and needs an explicit draft/published rule. Some code repairs missing `study.id` from the record key. |
| Links | `user.bible.links`; record key is link ID; URL, custom/OpenGraph metadata, `linkType`, `date`, tags | Global view filters by tag and sorts newest first; contextual verse view shares the component but is out of scope | Unbounded virtualized list | Global list derives references by scanning every relation for every link (`O(links * relations)`). Query changes must not multiply that work. List keys currently use indexes rather than link IDs. |
| Mixed Highlights | `user.bible.highlights`; canonical verse key; color, date, tags | Color, tag, and type/version filter; newest first | Highlights: newest 100 raw entries before grouping. Annotations: newest 100 in selector. Combined output uses `ScrollView`. | Highlight grouping uses one mutation timestamp as an action group. Highlight has no version. Section/book and canonical order can be derived from verse keys without loading Bible text. |
| Dedicated Word Annotations | `user.bible.wordAnnotations`; annotation `id`; version, ranges, color, style type, date, tags, optional note | Local tabs for verse/date/flat; source sorted newest first; no filter shell or persistence | Unbounded `FlatList`, but grouped sections render nested mapped cards | “By verse” groups by first range only and group insertion order currently follows newest-first input, not canonical Bible order. “By date” uses locale-formatted strings as grouping keys. |

## Data shapes relevant to queries

### Tag

- Searchable field: `name`.
- Sortable fields: normalized `name`; derived count of live attached entities.
- Optional `date` exists but creation/update behavior does not establish it as a reliable
  last-used timestamp.
- Reverse indexes cover highlights, notes, links, studies, Hebrew/Greek Strong entries,
  dictionary words, Nave entries, and word annotations.

### Note

- Searchable fields already defined by global search: display title from `getNoteTitle` and
  `description`.
- Sortable fields: `date`, normalized display title, stable note ID.
- Filterable field: tags.

### Study

- Searchable fields already defined by global search: title and `deltaToPlainText(content.ops)`.
- Sortable fields: `modified_at`, `created_at`, normalized title, stable study ID.
- Filterable fields: tags and optional `published`.
- The product decision must define whether absent `published` means draft. Current creation does
  not set it, so treating absent as published would misclassify ordinary local studies.

### Link

- Searchable fields already defined by global search: custom title or OpenGraph title or URL,
  plus OpenGraph description or URL.
- Sortable fields: `date`, normalized derived title, stable link ID.
- Filterable fields: tags and `linkType` (`youtube`, `twitter`, `instagram`, `tiktok`, `vimeo`,
  `spotify`, `facebook`, `linkedin`, `github`, `website`).

### Highlight

- Identity and Bible position come from a `book-chapter-verse` record key.
- Sortable fields: `date`, parsed canonical Bible tuple, stable verse key.
- Filterable fields: color, tags, testament derived from book number, and book number.
- There is no version field and no text field. Filtering or ordering does not require loading a
  Bible database.

### Word annotation

- Identity: annotation `id`.
- Search/display text: `ranges[].text`; text search is deliberately out of scope for this map.
- Sortable fields: `date`, canonical tuple from the first non-empty range, stable annotation ID.
- Filterable fields: color, tags, annotation style `type`, Bible `version`, testament/book derived
  from ranges.
- A multi-range annotation can span verse keys; deterministic filtering must specify whether
  any range or only the first range must match section/book. “Any range” is safer and matches the
  annotation's full Bible footprint; ordering can still use the earliest canonical range.

## Reusable search modules

### Strong existing seam

`src/features/search/shared/searchItems.ts` already provides:

- `getNoteSearchItems` / `getSortedNoteSearchItems`
- `getStudySearchItems` / `getSortedStudySearchItems`
- `getLinkSearchItems` / `getSortedLinkSearchItems`

These adapters define the canonical title and description presented to search. Reusing them
keeps page search aligned with global search.

`src/features/search/shared/searchFuzzy.ts` provides:

- accent-insensitive normalization;
- `searchWithMatches` over title and description;
- a two-character minimum in the global search caller;
- Fuse threshold `0.15` for the default search.

The page feature should reuse the adapters and fuzzy matcher, but should not make page list
models depend on navigation endpoints or result-row rendering. A later architecture decision
should determine whether the current adapter interface remains the external seam or whether a
smaller generic searchable-document interface is extracted internally.

### Duplicate legacy seam

`useFuzzy` powers Tags with different semantics: threshold `0`, synchronous reconstruction of
the Fuse index on render, and a separate accent-removal implementation. It does not match the
global search behavior. The feature should choose one search language; the map already prefers
the global search semantics.

### Missing adapters

- Tags needs a search adapter for `name` if it moves to the global matcher.
- Highlights and word annotations do not need text-search adapters under the agreed scope.

## Persistence primitives

`atomWithAsyncStorage<T>(key, initialValue, { migrate })` is the established interface for small
persisted UI state:

- backed by the shared MMKV instance;
- hydrated on initialization (`getOnInit: true`);
- JSON encoded;
- supports per-key migrations and writes migrated state back immediately.

`searchFiltersAtom` is the closest precedent. It persists global section, book, version, sort,
and entity toggles and merges missing fields during migration.

Constraints for this effort:

- Use distinct stable keys per page, as agreed by product.
- Store only query state (query string and option identifiers), never denormalized entity data,
  derived tag objects, result arrays, or translated labels.
- Every persisted state needs a default and a migration that merges newly added fields.
- Persist tag IDs, color IDs, enum values, and book numbers; resolve labels from current state at
  render time. Missing referenced tags/colors must reconcile to “all” rather than remain active
  invisibly.
- Reset must write the default state, not only clear transient component state.
- Persisted query text is intentionally included for Tags, Notes, Studies, and Links.

## Current performance characteristics

- Global entity search converts the complete Notes/Studies/Links records to search items and
  creates a Fuse index per search invocation. It is deferred with a zero-delay task after a
  300 ms debounce and uses a two-character threshold in global mixed search.
- Rich study content conversion is proportional to total study content size whenever all study
  search items are rebuilt.
- Tags computes live counts by invoking a complex selector for each row; that selector reads all
  entity collections and relations. The desired count sorts should compute a single count index
  once per relevant state change.
- Notes resolves relation-backed references per note; Links scans the complete relation set per
  link. Search/filter/sort should operate on an already-normalized row model so these joins happen
  once, not once per query stage.
- Mixed Highlights truncates before combining and filtering all possible results and uses a
  `ScrollView`. This must be addressed for correct filtering, independent of performance tuning.
- No durable model imposes a maximum collection size. Tests should include synthetic large
  collections rather than relying on typical current user data.

## Constraints for the architecture decision

1. **One query state interface per page.** Callers should set/reset a small serializable state;
   they should not orchestrate search, filter, sort, tie-break, and stale-ID repair themselves.
2. **Pure query implementation.** Given normalized rows and query state, return deterministic
   rows. This is the natural test seam and must not perform navigation or persistence effects.
3. **Entity adapters at the seam.** Normalize Redux records once into page rows containing stable
   identity, searchable text, filter facets, sort keys, and render payload.
4. **Shared mechanics, page-owned vocabulary.** Search normalization, stable comparison,
   persisted-state hydration/migration, active-filter counting, and reset are shared. The set of
   available options and defaults remains page-specific.
5. **Do not couple UI query state to Firestore.** The state belongs in MMKV/Jotai, not under
   `user.bible`, and therefore must not enter backup or sync payloads unless a later explicit
   product decision changes that boundary.
6. **Query before display limiting.** Never truncate a collection before applying active filters
   and ordering. If rendering still needs pagination/windowing, apply it after the complete query.
7. **Stable deterministic ordering.** Every comparator needs an ID fallback. Bible ordering must
   parse numbers, not compare verse-key strings lexicographically (`1-10-2` vs `1-2-10`).
8. **React Compiler conventions.** New code should not add `useMemo`, `useCallback`, or `memo`;
   pure modules and selectors provide the needed locality and testability.
9. **Filter-shell compatibility.** Preserve `FiltersHeader` as the presentation shell where it
   has leverage, but do not push entity-query logic or persistence into it. Its interface may need
   a small extension for an action-like Search row and active-state summary.
10. **No relation-feature expansion.** Existing system relations may still be read to render
    references, but relation count/type is not a new filter dimension in this effort.

## Questions now sharp enough for downstream tickets

- Should missing `published` be defined as draft? The existing creation path strongly suggests
  yes.
- For section/book filtering of multi-range annotations, should any matching range include the
  annotation? The audit recommends yes, with the earliest range as the canonical sort position.
- Should the dedicated annotation page and mixed Highlights page share the same persisted
  filter state? The agreed “separate per page” rule implies no, even though they query the same
  durable collection.
- Should a two-character minimum apply inside entity pages? Global mixed search requires it, but
  browsing a single entity type currently permits empty queries and Tags currently accepts one
  character. This requires an explicit semantic decision.
- Should active-filter count include non-default sort and search text? The existing
  `FiltersHeader` only counts structured filters and needs a consistent rule.

