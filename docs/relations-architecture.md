# Relations Architecture

This document describes a target architecture for a unified relation system in Bible Strong.
It is intentionally separate from the migration plan: the goal here is to define the domain
model, storage shape, query strategy, denormalization strategy, and performance constraints before
moving existing `studyRelations`, tags, notes, links, or verse metadata.

## Context

Bible Strong already has several features that behave like relations:

- a note attached to a verse or word annotation;
- an external link attached to a verse selection;
- a tag attached to a note, study, highlight, link, or verse-related object;
- a study relation between two openable entities;
- a Strong, Nave, or dictionary entry connected to a passage by user intent;
- a study document that mentions or explains verses, Strong entries, Nave topics, or dictionary words.

Today these concepts are stored in separate feature-specific objects. That is useful for simple
feature ownership, but it becomes limiting when the UI wants the same behavior everywhere:

- show a relation count beside an entity;
- open all related entities from a verse, note, study, Strong, Nave topic, or dictionary word;
- filter relation types;
- sync relation data predictably to Firestore;
- keep list and BibleViewer rendering fast.

The proposed architecture is to keep feature-owned content objects, but move cross-object edges into
a unified relation graph.

## Design Goals

- Represent links between verses, notes, studies, Strong entries, Nave topics, dictionary words,
  external links, and user words through one relation model.
- Keep tags as an organization/indexing system rather than forcing them into the bidirectional
  relation graph.
- Preserve the difference between the entity being linked and the semantic meaning of the link.
- Support both user-editable semantic relations and fixed structural relations.
- Query relations from either endpoint efficiently.
- Keep BibleViewer indicators and list chips fast without scanning every relation on every render.
- Support offline-first local state and Firestore sync.
- Allow endpoint deletion without destroying relation history immediately.
- Avoid storing translated Bible reference labels as the only source of truth.

## Non-Goals

- This document does not define the migration steps from current data.
- This document does not require all current notes, links, or highlights to move at once.
- This document does not require tags to become relation endpoints.
- This document does not require every existing feature object to become a relation endpoint.
- This document does not replace the content models for notes, studies, tags, or links.

## Core Concepts

### Entity

An entity is an object that can participate in the relation graph.

Target schema entity types:

```ts
type RelationEntityType =
  | 'verse'
  | 'note'
  | 'study'
  | 'strong'
  | 'nave'
  | 'dictionary'
  | 'externalLink'
  | 'word'
```

Version 1 should distinguish implemented endpoint types from reserved schema types:

- implemented immediately: `verse`, `note`, `study`, `strong`, and `externalLink`;
- reserved by the schema until a feature needs them: `nave`, `dictionary`, and `word`.

Tags should not be relation endpoints in the target model. They are organization metadata applied to
entities and they move in one direction: a user classifies an entity with a tag. That is different
from a relation, which is an openable edge between two study objects.

Highlights, word annotations, bookmarks, and plan slices stay outside the relation endpoint model.
When they need organization metadata, they should use their own feature model or tags. When they need
study navigation, the relation should usually target the underlying verse, note, study, link, or
resource entity instead.

### Endpoint

An endpoint is the durable identity of one side of a relation. It contains enough structured data to
rebuild display text later, plus a fallback label for orphaned or unavailable resources.

```ts
type RelationEndpoint =
  | VerseEndpoint
  | NoteEndpoint
  | StudyEndpoint
  | StrongEndpoint
  | NaveEndpoint
  | DictionaryEndpoint
  | ExternalLinkEndpoint
  | WordEndpoint
```

Each endpoint has a canonical `key`.

```ts
type RelationEndpointBase = {
  type: RelationEntityType
  key: string
  labelFallback?: string
}
```

Examples:

```ts
{
  type: 'verse',
  key: 'verse:1-1-2',
  verseKeys: ['1-1-2'],
  reference: {
    start: { book: 1, chapter: 1, verse: 2 },
    end: { book: 1, chapter: 1, verse: 2 }
  },
  labelFallback: 'Genèse 1:2'
}
```

```ts
{
  type: 'strong',
  key: 'strong:greek:26',
  language: 'greek',
  code: '26',
  originalWord: 'ἀγάπη',
  labelFallback: 'agape'
}
```

```ts
{
  type: 'externalLink',
  key: 'externalLink:1-1-2/0f4a86d5-2fb2-4622-b6aa-bb2c30dfc7b7',
  linkId: '0f4a86d5-2fb2-4622-b6aa-bb2c30dfc7b7',
  url: 'https://example.com/article',
  labelFallback: 'Article sur Genèse 1'
}
```

### Relation

A relation is a binary edge between exactly two endpoints.

```ts
type Relation = {
  id: string
  kind: RelationKind
  type: RelationType
  direction: RelationDirection
  endpoints: [RelationEndpoint, RelationEndpoint]
  endpointKeys: [string, string]
  endpointTypes: [RelationEntityType, RelationEntityType]
  pairKey: string
  duplicateKey: string
  label?: string
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
  deletedAt?: number
}
```

`endpointKeys` duplicates endpoint identities to make Firestore queries simple. `pairKey` and
`duplicateKey` make duplicate detection and idempotent writes easier.

## Relation Kind vs Relation Type

The relation system should not make every relation equally editable.

`kind` describes where the relation comes from:

```ts
type RelationKind = 'manual' | 'system'
```

- `manual`: the user intentionally creates a semantic relation between two entities.
- `system`: the relation is implied by a feature action, such as attaching a note or external link.

`type` describes the meaning of the edge:

```ts
type RelationType =
  | 'linked'
  | 'references'
  | 'explains'
  | 'contrasts'
  | 'mentions'
  | 'annotates'
  | 'externalLink'
```

Examples:

| Scenario | Kind | Type | Editable type | Editable direction |
|---|---:|---:|---:|---:|
| Verse linked to verse by user | `manual` | `linked` | yes | no |
| Study explains a verse | `manual` | `explains` | yes | yes |
| Study mentions a Strong entry | `manual` or `system` | `mentions` | maybe | yes |
| Note attached to a verse | `system` | `annotates` | no | no |
| URL attached to a verse | `system` | `externalLink` | no | no |

This keeps storage unified while preserving business meaning. A tag-to-verse relation should not be
modeled as a relation in this target architecture; a note-to-verse relation should not be changed
into `references`. But a study-to-verse relation may allow `linked`, `references`, `explains`, or
`mentions`.

## Capabilities Matrix

The app should use a capabilities matrix to decide which relation types are allowed between two
endpoint types.

```ts
type RelationCapabilities = {
  allowedTypes: RelationType[]
  defaultType: RelationType
  defaultKind: RelationKind
  editableType: boolean
  editableDirection: boolean
}
```

Example target matrix:

```ts
const RELATION_CAPABILITIES: Record<string, RelationCapabilities> = {
  'verse:verse': {
    allowedTypes: ['linked', 'references', 'explains', 'contrasts'],
    defaultType: 'linked',
    defaultKind: 'manual',
    editableType: true,
    editableDirection: true,
  },
  'verse:study': {
    allowedTypes: ['linked', 'references', 'explains', 'mentions'],
    defaultType: 'linked',
    defaultKind: 'manual',
    editableType: true,
    editableDirection: true,
  },
  'study:strong': {
    allowedTypes: ['linked', 'mentions', 'explains'],
    defaultType: 'mentions',
    defaultKind: 'manual',
    editableType: true,
    editableDirection: true,
  },
  'externalLink:verse': {
    allowedTypes: ['externalLink'],
    defaultType: 'externalLink',
    defaultKind: 'system',
    editableType: false,
    editableDirection: false,
  },
  'note:verse': {
    allowedTypes: ['annotates'],
    defaultType: 'annotates',
    defaultKind: 'system',
    editableType: false,
    editableDirection: false,
  },
}
```

The capability lookup key should be order-insensitive unless the product intentionally needs ordered
endpoint types. For example, `verse:study` and `study:verse` should resolve to the same capability
definition. Directional relations still need a separate source rule; the capability matrix only says
which type pairs are allowed.

## Direction

```ts
type RelationDirection = 'none' | 'forward' | 'backward'
```

Rules:

- `linked`, `contrasts`, `annotates`, and `externalLink` are non-directional by default.
- `references`, `explains`, and `mentions` may be directional.
- Direction is interpreted relative to the stored endpoint order.
- A relation is visible from both endpoints even when directional.
- For directional relations, creation must either store an explicit source endpoint or normalize the
  endpoint order so that endpoint `0` is the source. Without that rule, creating `study explains
  verse` from the verse screen could accidentally store `verse explains study`.

Example:

```ts
{
  type: 'explains',
  direction: 'forward',
  endpoints: [studyEndpoint, verseEndpoint]
}
```

From the study: "explique Genèse 1:2".
From the verse: "expliqué par Étude du chef".

## Entity Keys

Entity keys must be stable, compact, and language-independent.

| Entity | Key format | Notes |
|---|---|---|
| Verse | `verse:{verseKey}` or `verse:{startVerseKey}/{endVerseKey}` | Exact selected range identity. |
| Note | `note:{noteId}` | Annotation note ids can keep their prefix. |
| Study | `study:{studyId}` | User study document id. |
| Strong | `strong:{language}:{normalizedCode}` | `strong:greek:26`, `strong:hebrew:7225`. |
| Nave | `nave:{resourceLanguage}:{normalizedName}` | Include language if Nave databases differ by language. |
| Dictionary | `dictionary:{resourceLanguage}:{normalizedWord}` | Include language to avoid collisions. |
| External link | `externalLink:{sourceKey}/{linkId}` | Keep link id unique under its source selection. |
| Word | `word:{resourceLanguage}:{normalizedWord}` | User/resource word identity. |

Tags keep their own durable ids in the tag system, but they are not relation endpoint keys.

Verse labels should be rebuilt from structured references at display time. `labelFallback` is only a
snapshot for deleted, unsupported, or migration-era data.

## Verse Range Identity

Verse ranges require special care.

A relation on `Genèse 1:2-4` is not the same as a relation on `Genèse 1:2`, `Genèse 1:3`, or
`Genèse 1:4`.

Therefore:

- The canonical key for a verse endpoint must represent the exact selected range.
- BibleViewer indicators should use the first verse of the selected range only when the relation
  endpoint itself starts there.
- A single verse should not show relation counts for every larger range that happens to include it.
- A grouped relation modal may show sections for exact ranges that start at the selected verse.

Recommended verse endpoint:

```ts
type VerseEndpoint = RelationEndpointBase & {
  type: 'verse'
  key: string
  verseKeys: string[]
  reference: {
    start: { book: number; chapter: number; verse: number }
    end: { book: number; chapter: number; verse: number }
  }
}
```

Recommended key examples:

```txt
verse:1-1-2
verse:1-1-2/1-1-4
```

The app can keep `verseKeys` for local display and range expansion, but should not treat every member
of `verseKeys` as an independent relation target.

## Firestore Storage

Firestore should keep a canonical relation collection and one or more read-optimized indexes.

Current Firestore constraints still favor explicit modeling for known access patterns:

- documents and subcollections are the primary storage structure;
- larger arrays embedded in one document make retrieval slower as they grow;
- collection group queries work across subcollections with the same id;
- aggregation queries such as `count()` reduce reads for occasional counts but do not replace hot UI
  counters;
- high-write counters may require sharded counters.

References:

- Firebase data model: https://firebase.google.com/docs/firestore/data-model
- Firebase data structure guidance: https://firebase.google.com/docs/firestore/manage-data/structure-data
- Firebase queries: https://firebase.google.com/docs/firestore/query-data/queries
- Firebase aggregation queries: https://firebase.google.com/docs/firestore/query-data/aggregation-queries
- Firebase distributed counters: https://firebase.google.com/docs/firestore/solutions/counters

### Canonical Collection

```txt
/users/{uid}/relations/{relationId}
```

Example:

```ts
{
  id: '17257f89-262f-4237-99c6-713caab131a8',
  kind: 'manual',
  type: 'linked',
  direction: 'none',
  endpoints: [
    {
      type: 'verse',
      key: 'verse:1-1-2/1-1-4',
      verseKeys: ['1-1-2', '1-1-3', '1-1-4'],
      reference: {
        start: { book: 1, chapter: 1, verse: 2 },
        end: { book: 1, chapter: 1, verse: 4 }
      },
      labelFallback: 'Genèse 1:2-4'
    },
    {
      type: 'note',
      key: 'note:16-2-1',
      noteId: '16-2-1',
      labelFallback: 'Ma note'
    }
  ],
  endpointKeys: ['verse:1-1-2/1-1-4', 'note:16-2-1'],
  endpointTypes: ['verse', 'note'],
  pairKey: 'note:16-2-1|verse:1-1-2/1-1-4',
  duplicateKey: 'linked:note:16-2-1|verse:1-1-2/1-1-4',
  createdAt: 1779435717722,
  updatedAt: 1779435717722
}
```

### Endpoint Index Collection

```txt
/users/{uid}/relationIndex/{encodedEntityKey}
```

This is the fast counter/projection used by chips, BibleViewer indicators, and list rows.

```ts
{
  entityKey: 'verse:1-1-2',
  totalCount: 4,
  countsByType: {
    linked: 2,
    references: 1,
    annotates: 1
  },
  countsByEntityType: {
    note: 1,
    study: 1,
    strong: 1,
    externalLink: 1,
    verse: 1
  },
  updatedAt: 1779435717722
}
```

This document should remain small. It is not a place to store the full relation list.

Optional preview fields can be added later:

```ts
preview: [
  {
    relationId: 'rel_1',
    type: 'linked',
    target: {
      type: 'verse',
      key: 'verse:1-4-6',
      labelFallback: 'Genèse 4:6'
    }
  }
]
```

Preview denormalization should only be added if profiling shows that opening relation lists or
rendering chips needs it.

### Pair Index Collection

The canonical relation collection can use `duplicateKey`, but a dedicated pair index can make
idempotent creation safer when offline sync and concurrent writes become important.

```txt
/users/{uid}/relationPairs/{stablePairId}
```

```ts
{
  duplicateKey: 'linked:note:16-2-1|verse:1-1-2',
  relationId: 'rel_1',
  createdAt: 1779435717722
}
```

`stablePairId` is a Firestore-safe deterministic id derived from `duplicateKey`; the full
`duplicateKey` stays in the document for lookup and reconciliation. This index can be written in the
same batch as the relation. It lets the app detect an existing edge without scanning all relations.

`relationPairs` is not a full uniqueness guarantee by itself when clients create relations offline
with random relation ids. Two devices can still create two canonical `relations/{relationId}`
documents with the same `duplicateKey`, while the pair index only points at the last writer. If
strict uniqueness is required, use one of these strategies:

- make `duplicateKey` the canonical relation document id;
- create relations through a Firestore transaction when online;
- reconcile duplicate canonical relations with a backend job or Cloud Function.

## Query Strategy

### Open Relations for One Entity

Use the canonical relation collection:

```ts
relations
  .where('endpointKeys', 'array-contains', entityKey)
  .orderBy('updatedAt', 'desc')
```

This powers:

- relation modal for a verse;
- relation modal for a note;
- relation modal for a study;
- Strong, Nave, dictionary detail relation lists;
- "edit relations" surfaces.

### Show Counts in Lists

Do not query relation documents row by row. Use `relationIndex`.

For small lists, fetch the index docs by id:

```txt
relationIndex/{entityKeyA}
relationIndex/{entityKeyB}
relationIndex/{entityKeyC}
```

For BibleViewer, compute the needed entity keys for the visible chapter or current rendered chapter
and read the corresponding local Redux index. The render path should not issue remote reads.

Locally, `relations` should remain the canonical source. `relationIndex` may be stored in Firestore
as a remote projection, but Redux should rebuild the local index from canonical relations during
hydration and live updates, or the backend must own projection updates atomically. Syncing
`relations` and `relationIndex` as independent live subcollections can otherwise make counters
temporarily or permanently diverge when snapshots arrive in different orders or one write fails.

### BibleViewer Chapter Indicators

BibleViewer needs a cheap map:

```ts
type RelationIndicatorsByVerse = Record<string, number>
```

The selector should be derived from an endpoint index, not by scanning all relation documents every
time a chapter renders.

Recommended local shape:

```ts
type RelationIndexObj = Record<
  string,
  {
    entityKey: string
    totalCount: number
    countsByType?: Partial<Record<RelationType, number>>
    updatedAt: number
  }
>
```

For a chapter, derive only exact verse endpoint keys:

```ts
verse:1-1-1
verse:1-1-2
verse:1-1-3
```

Range endpoints that start at a verse can be shown in grouped relation modals, but should not inflate
single-verse indicators unless the UI explicitly means "relations starting here".

### Grouped Verse Relation Modal

When the user opens relations from `Genèse 1:2`, the modal may show sections:

```txt
Genèse 1:2
  relation A
  relation B

Genèse 1:2-4
  relation C
```

The query can fetch relations whose verse endpoint starts at the selected verse.

Firestore cannot efficiently query inside arbitrary endpoint object arrays, so store a projection:

```ts
verseStartKeys: ['1-1-2']
verseEndpointKeys: ['verse:1-1-2', 'verse:1-1-2/1-1-4']
```

Then query:

```ts
relations
  .where('verseStartKeys', 'array-contains', '1-1-2')
  .orderBy('updatedAt', 'desc')
```

Locally, the same grouping can be derived from relation endpoints.

### Detect Duplicate Relation

For non-directional relation types:

```ts
pairKey = sort([endpointA.key, endpointB.key]).join('|')
duplicateKey = `${type}:${pairKey}`
```

For directional relation types, use the same pair key but keep direction in the relation:

```ts
duplicateKey = `${type}:${pairKey}`
```

This allows one `references` relation between the same pair, whose direction can be edited rather
than creating a second inverse relation.

If the product later needs two opposite directional relations between the same entities, change the
duplicate rule for those types:

```ts
duplicateKey = `${type}:${directionalSourceKey}->${directionalTargetKey}`
```

### Search Relations by Target Type

Firestore only permits one `array-contains` filter per disjunction, so do not combine
`endpointKeys array-contains` with `endpointTypes array-contains`.

For filters such as "show only relations from this entity to notes", prefer a lookup projection:

```ts
relations
  .where('lookupKeys', 'array-contains', `endpointTargetType:${entityKey}:note`)
  .orderBy('updatedAt', 'desc')
```

For small relation counts, it is also acceptable to fetch all relations for the entity and filter
locally:

```ts
relations
  .where('endpointKeys', 'array-contains', entityKey)
  .orderBy('updatedAt', 'desc')
```

Example lookup keys:

```ts
lookupKeys: [
  'endpoint:verse:1-1-2',
  'endpoint:note:16-2-1',
  'endpointTargetType:verse:1-1-2:note',
  'endpointRelationType:verse:1-1-2:linked',
  'type:linked'
]
```

Then the main entity query still uses one `array-contains`.

## Denormalization Strategy

Denormalization is necessary, but it should be deliberately limited.

### Canonical Source

`relations/{relationId}` is the source of truth for:

- relation type;
- direction;
- endpoints;
- label;
- creation/update timestamps.

### Required Denormalized Fields on Relation

These fields duplicate endpoint data for query performance:

- `endpointKeys`
- `endpointTypes`
- `pairKey`
- `duplicateKey`
- `verseStartKeys`
- `verseEndpointKeys`
- `lookupKeys` when target-type or relation-type filtered queries are needed

### Required Denormalized Index

`relationIndex/{entityKey}` stores:

- `totalCount`
- optional `countsByType`
- optional `countsByEntityType`
- `updatedAt`

### Avoid by Default

Avoid these until profiling proves they are needed:

- embedding all relation ids in the index document;
- embedding full target labels for every relation in the index;
- storing large arrays of all relation previews;
- writing relation projections into every content object.

Large embedded arrays grow document size and can slow reads. For relation lists, query the relation
collection. For counts, use compact index documents.

## Write Path

### Create Relation

1. Normalize endpoints.
2. Resolve capabilities for the endpoint type pair.
3. Choose default `kind`, `type`, and `direction`.
4. Build `endpointKeys`, `endpointTypes`, `pairKey`, and `duplicateKey`.
5. Validate duplicate rule.
6. Write relation document.
7. Update `relationIndex` for both endpoint keys.
8. Optionally write `relationPairs/{stablePairId}`.

Firestore batch write:

```txt
set users/{uid}/relations/{relationId}
set users/{uid}/relationPairs/{stablePairId}
set or update users/{uid}/relationIndex/{endpointAKey}
set or update users/{uid}/relationIndex/{endpointBKey}
```

For offline-first Redux, the local reducer should do the same logical updates synchronously, then
the Firestore middleware syncs the changed subcollections.

### Update Relation

When `type`, `direction`, `label`, or endpoints change:

1. Read old relation locally.
2. Normalize the new relation.
3. If endpoints or type changed, recompute duplicate keys and index deltas.
4. Update relation document.
5. Decrement old endpoint indexes if endpoints changed.
6. Increment new endpoint indexes if endpoints changed.
7. Update `relationPairs` if duplicate key changed.

Endpoint changes should be treated as delete + create for index maintenance.

### Delete Relation

Prefer soft delete only if undo, conflict resolution, or audit history is needed. Otherwise hard
delete is simpler.

Hard delete:

1. Delete `relations/{relationId}`.
2. Delete `relationPairs/{stablePairId}`.
3. Decrement `relationIndex` for both endpoint keys.
4. Remove index docs when count reaches zero.

### Delete Endpoint

When a note, study, external link, or other endpoint is deleted, do not automatically delete every
manual relation in the first version of this architecture.

Recommended behavior for `manual` relations:

- keep relation documents;
- mark resolved target as unavailable in the UI;
- keep fallback labels;
- offer cleanup later if needed.

This avoids destructive cascade bugs and preserves study context after sync conflicts or resource
unavailability.

Recommended behavior for `system` relations:

- delete `annotates` relations when the source note is deleted;
- delete `externalLink` relations when the source external link is deleted;
- update or recreate the system relation if the source feature object changes its durable key.

System relations are projections of feature-owned objects. Keeping them after their source object is
deleted creates stale counters and unavailable rows for objects the user did not intentionally keep
as study history.

## Local Redux Shape

Target local state:

```ts
type UserBibleState = {
  relations: RelationsObj
  relationIndex: RelationIndexObj
}
```

Compatibility during migration:

```ts
type UserBibleState = {
  studyRelations?: StudyRelationsObj
  relations?: RelationsObj
  relationIndex?: RelationIndexObj
}
```

Selectors should read from the new model when present and fall back to `studyRelations` during
migration.

Important selector families:

```ts
selectRelations
selectRelationIndex
makeRelationsForEndpointSelector
makeRelationDisplayModelsSelector
makeRelationSectionsForStartingVerseKeySelector
makeRelationIndicatorsByChapterSelector
selectRelationCountsByEndpointKey
```

For list performance, row components should receive a count from a selector-derived map rather than
creating one selector per row that scans all relations.

## Firestore Sync Shape

Current sync uses per-user subcollections. The target model should fit the same approach:

```txt
/users/{uid}/relations/{relationId}
/users/{uid}/relationIndex/{encodedEntityKey}
/users/{uid}/relationPairs/{stablePairId}
```

Potential `SUBCOLLECTION_NAMES` additions:

```ts
'relations'
'relationIndex'
'relationPairs'
```

`relationPairs` may be omitted if duplicate detection remains local-only initially, but it becomes
useful once concurrent multi-device writes matter.

## Security Rules Direction

Rules should enforce user ownership and basic shape, not every domain rule.

Minimum:

- users can only read/write their own relation subcollections;
- `endpointKeys` must have exactly two entries;
- `endpointTypes` must have exactly two entries;
- `type`, `kind`, and `direction` must be in known enum sets;
- timestamps must be present.

Business rules such as the capabilities matrix should live in client code first. If server-side
enforcement becomes necessary, add Cloud Functions or stricter rules once the model stabilizes.

## Query Cost Guidelines

Use these defaults:

- Relation modal: one relation query for the active endpoint.
- Entity chip/count: one index doc read per entity, preferably already in local Redux.
- BibleViewer chapter: no remote reads during render; use synced local index.
- Search results: do not fetch relation docs for every result by default; show counts only if
  relation indexes are already local or fetched in batch.
- Count-only analytics: Firestore aggregation `count()` is acceptable for occasional screens, not
  for per-row real-time UI.

## Indexing Notes

Likely Firestore indexes:

- `relations`: `endpointKeys array-contains`, `updatedAt desc`
- `relations`: `verseStartKeys array-contains`, `updatedAt desc`
- `relations`: `endpointKeys array-contains`, `type`, `updatedAt desc`
- `relations`: `duplicateKey`

If Firestore asks for composite indexes, create only the combinations used by real screens.

## Display Rules

Relation display should be built from structured endpoint data:

- Verse display uses current language book names and reference formatting.
- Strong display uses language + normalized code + original word where available.
- Nave and dictionary display use current resource language when possible.
- External links display their current title/Open Graph title when available.
- Tags display through the tag system, not the relation display model.
- Fallback labels are only for deleted/unavailable/migrated endpoints.

This avoids stale labels such as a stored French `Genèse 1:2` appearing when the app language changes.

## Tags Decision

Tags should remain outside the unified relation graph for now.

Reasoning:

- A tag is classification metadata, not a study object the user usually navigates "to" as one side of
  an edge.
- Tag application is one-directional: an entity has tags. The tag does not need the same type,
  direction, label, duplicate, and relation wording machinery as study relations.
- Keeping tags separate avoids hard questions around whether tags apply to a verse, highlight,
  annotation, note, study, or relation itself.
- The existing tag UI wants chips, filters, and grouped lists more than relation editing.

Target shape:

```ts
type TagAssignment = {
  tagId: string
  entityKey: string
  entityType: RelationEntityType | 'highlight' | 'wordAnnotation'
  createdAt: number
}
```

This can still use relation-like entity keys for consistency, but it should live in a tag-specific
store/index:

```txt
/users/{uid}/tagAssignments/{assignmentId}
/users/{uid}/tagIndex/{encodedEntityKey}
```

That gives the app the same query benefits without pretending that tags are semantic relations.

## Open Questions

- Should word annotations become endpoints, or should their notes/tags point to the parent verse?
- Should external links become first-class endpoints immediately, or be added after the manual
  relation model is renamed?
- Should tags move from embedded references to a dedicated `tagAssignments` index, or should the
  current model remain because it already serves filtering well?
- Should relation indexes store previews for faster relation modals, or are counts enough?
- Should duplicate detection allow multiple manual relations between the same pair when labels differ?
- Should user-authored studies automatically create `mentions` relations when they contain verse or
  Strong references, or should those remain explicit user actions?

## Recommended First Implementation Slice

When implementation starts, the safest first slice is:

1. Rename domain language from `studyRelations` to `relations` in new types only.
2. Keep current study relation UI behavior unchanged.
3. Add `kind`, `endpointKeys`, `endpointTypes`, `pairKey`, and `duplicateKey`.
4. Add `relationIndex` locally and selectors that use it for counts.
5. Keep existing `studyRelations` data readable through an adapter.
6. Add Firestore subcollections only after local behavior is stable.

This gives the app a graph-shaped model without forcing notes, external links, tags, or highlights to
migrate before the relation core is proven.
