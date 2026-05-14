# Data Models

This document describes the durable data shapes that matter most for app behavior and agent work.

## Identifiers

| Identifier | Shape | Notes |
|---|---|---|
| Bible version code | `LSG`, `KJV`, `BHS`, etc. | Defined in `src/helpers/bibleVersions.ts`. |
| Verse key | `book-chapter-verse` | Common user-data key, for example `1-27-2`. |
| Verse range key | Often slash-joined verse keys | Used by links/notes/actions that can span selections. |
| Database id | `STRONG`, `DICTIONNAIRE`, `NAVE`, etc. | Defined in `src/helpers/databaseTypes.ts`. |
| Tab id | string | Generated in `src/state/tabs.ts`. |
| Tag id | string | Stored in `user.bible.tags` and referenced by entities. |

## Redux Root

`src/redux/modules/reducer.ts` combines:

- `user`
- `plan`

The root is persisted through redux-persist/MMKV in `src/redux/store.ts`. `plan` has its own persist config and excludes online plan fetch state.

## User State

`src/redux/modules/user.ts` defines `UserState`.

Top-level user metadata:

- `id`
- `email`
- `displayName`
- `photoURL`
- `provider`
- `subscription`
- `emailVerified`
- `createdAt`
- `isLoading`

Bible-owned durable state under `user.bible`:

- `bookmarks`
- `highlights`
- `notes`
- `links`
- `studies`
- `tags`
- `strongsHebreu`
- `strongsGrec`
- `words`
- `naves`
- `wordAnnotations`
- `settings`

## Study

```ts
interface Study {
  id: string
  title: string
  created_at: number
  modified_at: number
  content: { ops: JSONValue[] } | null
  published?: boolean
  user: { displayName: string; id: string; photoUrl: string }
  tags?: Record<string, Tag>
}
```

Study content is rich text delta-like content.

## Note

```ts
interface Note {
  id?: string
  title: string
  description: string
  date: number
  tags?: Record<string, Tag>
}
```

Notes can be attached to verse selections or word annotations.

## Highlight

```ts
type HighlightType = 'background' | 'textColor' | 'underline'

type Highlight = {
  color: string
  tags?: TagsObj
  date: number
}
```

Highlights are verse-level marks. Tapping the currently selected color in `ColorCirclesBar` toggles the highlight off.

## Word Annotation

Word annotations are created in Mode libre and are separate from verse-level highlights. They are stored in `user.bible.wordAnnotations` and coordinated by:

- `src/features/bible/hooks/useAnnotationMode.ts`
- `src/features/bible/AnnotationToolbar.tsx`
- `src/features/bible/BibleDOM/AnnotationMode/`

They support color/type changes, tags, notes, and deletion.

## Link

```ts
type LinkType =
  | 'youtube'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'vimeo'
  | 'spotify'
  | 'facebook'
  | 'linkedin'
  | 'github'
  | 'website'

interface Link {
  id?: string
  url: string
  customTitle?: string
  ogData?: OpenGraphData
  linkType: LinkType
  videoId?: string
  date: number
  tags?: Record<string, Tag>
}
```

## Settings

Bible settings include:

- default Bible version
- alignment, line height, font scale, text display
- preferred color scheme and light/dark themes
- press behavior
- inline/block display settings for notes, links, and tags
- comments and red-letter display
- share options
- theme colors
- comparison versions
- custom highlight colors and default color names/types

Settings affect both native UI and Bible DOM rendering.

## Jotai Tabs

`src/state/tabs.ts` defines tab item types:

- `BibleTab`
- `SearchTab`
- `CompareTab`
- `StrongTab`
- `NaveTab`
- `DictionaryTab`
- `StudyTab`
- `NotesTab`
- `CommentaryTab`
- `NewTab`

Tab groups are persisted and form the app switcher workspace.

## Resource Databases

`src/helpers/databaseTypes.ts` defines:

- Language-specific databases: `STRONG`, `DICTIONNAIRE`, `NAVE`, `MHY`, `INTERLINEAIRE`, `TIMELINE`
- Shared databases: `TRESOR`, `BIBLES`
- User-selectable resource language databases: `STRONG`, `DICTIONNAIRE`, `NAVE`, `MHY`, `INTERLINEAIRE`, `TIMELINE`
- French-only databases: `MHY`

Local paths:

- SQLite base: `documentDirectory/SQLite`
- Language-specific SQLite: `documentDirectory/SQLite/{lang}`
- Shared SQLite: `documentDirectory/SQLite/shared`
- Language-specific JSON: `documentDirectory/{lang}`

Remote URLs are defined in `src/helpers/firebase.ts` and use `https://assets.bible-strong.app/`.

## Firestore Sync

`src/redux/firestoreMiddleware.ts` observes Redux actions and syncs user Bible data for authenticated users. Firestore subcollection helpers live in `src/helpers/firestoreSubcollections.ts`.

Any change that rewrites keys, entity shapes, or sync timing must include migration and rollback thinking.

