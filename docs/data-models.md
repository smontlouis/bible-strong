# Modèles de Données - Bible Strong

> Généré automatiquement le 2026-01-06

## Vue d'ensemble

Ce document décrit les structures de données utilisées dans l'application.

## État Redux

### UserState

Structure principale de l'état utilisateur.

```typescript
interface UserState {
  // Identité
  id: string                    // Firebase UID
  email: string
  displayName: string
  photoURL: string
  provider: string              // 'email' | 'google.com' | 'apple.com'
  subscription?: SubscriptionType
  emailVerified: boolean
  createdAt: string | null

  // UI State
  isLoading: boolean
  fontFamily: string            // Police globale

  // Notifications
  notifications: {
    verseOfTheDay: string       // Heure (ex: '07:00')
    notificationId: string
  }

  // Changelog
  changelog: {
    isLoading: boolean
    lastSeen: number
    data: ChangelogItem[]
  }

  // Mises à jour
  needsUpdate: Record<string, boolean>

  // Données Bible
  bible: BibleData
}
```

### BibleData

```typescript
interface BibleData {
  // Annotations utilisateur
  bookmarks: BookmarksObj
  highlights: HighlightsObj
  notes: NotesObj
  links: LinksObj
  studies: StudiesObj
  tags: TagsObj

  // Données Strong (cache local)
  strongsHebreu: Record<string, unknown>
  strongsGrec: Record<string, unknown>
  words: Record<string, unknown>
  naves: Record<string, unknown>

  // Changelog lu
  changelog: Record<string, boolean>

  // Paramètres
  settings: BibleSettings
}
```

### BibleSettings

```typescript
interface BibleSettings {
  // Version par défaut
  defaultBibleVersion?: string    // 'LSG' | 'KJV' | etc.

  // Affichage texte
  alignContent: 'left' | 'justify'
  lineHeight: 'normal' | 'small' | 'large'
  fontSizeScale: number           // -5 à +5
  textDisplay: 'inline' | 'block'
  fontFamily: string

  // Thème
  preferredColorScheme: 'auto' | 'light' | 'dark'
  preferredLightTheme: PreferredLightTheme
  preferredDarkTheme: PreferredDarkTheme
  theme: string                   // Thème actif calculé
  colors: ThemeColors             // Toutes les palettes

  // Interaction
  press: 'shortPress' | 'longPress'
  notesDisplay: 'inline' | 'block'
  linksDisplay: 'inline' | 'block'
  commentsDisplay: boolean

  // Partage
  shareVerses: {
    hasVerseNumbers: boolean
    hasInlineVerses: boolean
    hasQuotes: boolean
    hasAppName: boolean
  }

  // Comparaison versions
  compare: Record<string, boolean>

  // Couleurs personnalisées
  customHighlightColors: CustomColor[]
  defaultColorNames?: Record<string, string>
  defaultColorTypes?: Record<string, HighlightType>
}
```

## Entités utilisateur

### Bookmark (Favori)

```typescript
interface Bookmark {
  id: string                      // Ex: "bookmark-1234567890"
  date: number                    // Timestamp création
  book: number                    // Numéro du livre (1-66)
  chapter: number
  verse?: number                  // Optionnel (peut être au niveau chapitre)
  tags?: Record<string, boolean>  // Tags associés
}

// Clé dans BookmarksObj: id du bookmark
type BookmarksObj = Record<string, Bookmark>
```

### Highlight (Surlignage)

```typescript
interface Highlight {
  color: string                   // 'color-69D2E7' ou hex '#FF5733'
  tags: Record<string, boolean>   // Tags associés
  date: number                    // Timestamp
}

// Clé: "BOOK-CHAPTER-VERSE" ex: "1-1-1" (Genèse 1:1)
type HighlightsObj = Record<string, Highlight>

// Types de surlignage
type HighlightType = 'background' | 'textColor' | 'underline'
```

### Note

```typescript
interface Note {
  id?: string                     // Auto-généré si non fourni
  title: string
  description: string             // Contenu de la note
  date: number                    // Timestamp
  tags?: Record<string, boolean>
}

// Clé: "BOOK-CHAPTER-VERSE" ou plage "BOOK-CHAPTER-VERSE/BOOK-CHAPTER-VERSE"
type NotesObj = Record<string, Note>
```

### Link (Lien externe)

```typescript
interface Link {
  id?: string
  url: string                     // URL complète
  customTitle?: string            // Titre personnalisé
  ogData?: OpenGraphData          // Métadonnées extraites
  linkType: LinkType              // Type de lien
  videoId?: string                // Pour YouTube, Vimeo, TikTok
  date: number
  tags?: Record<string, boolean>
}

type LinkType =
  | 'youtube' | 'twitter' | 'instagram' | 'tiktok'
  | 'vimeo' | 'spotify' | 'facebook' | 'linkedin'
  | 'github' | 'website'

interface OpenGraphData {
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
  fetchedAt: number
}

// Clé: "BOOK-CHAPTER-VERSE" ou plage
type LinksObj = Record<string, Link>
```

### Study (Étude)

```typescript
interface Study {
  id: string                      // UUID unique
  title: string
  content: {
    ops: DeltaOperation[]         // Format Quill Delta
  } | null
  created_at: number
  modified_at: number
  published?: boolean             // Publié en ligne
  user: {
    id: string
    displayName: string
    photoUrl?: string
  }
  tags?: Record<string, Tag>
}

type StudiesObj = Record<string, Study>
```

### Tag

```typescript
interface Tag {
  id: string
  name: string
  color?: string                  // Hex color
  date: number                    // Création
}

type TagsObj = Record<string, Tag>
```

### CustomColor

```typescript
interface CustomColor {
  id: string
  hex: string                     // Ex: '#FF5733'
  createdAt: number
  name?: string                   // Nom personnalisé
  type?: HighlightType            // 'background' | 'textColor' | 'underline'
}
```

## État des onglets (Jotai)

### TabGroup

```typescript
interface TabGroup {
  id: string                      // 'default-group' ou UUID
  name: string                    // Nom affiché
  color?: string                  // Couleur du groupe
  isDefault: boolean
  tabs: TabItem[]
  activeTabIndex: number
  createdAt: number
  updatedAt: number
}

const MAX_TAB_GROUPS = 8
const DEFAULT_GROUP_ID = 'default-group'
```

### TabItem (Union Type)

```typescript
type TabItem =
  | BibleTab
  | SearchTab
  | CompareTab
  | StrongTab
  | NaveTab
  | DictionaryTab
  | StudyTab
  | NotesTab
  | CommentaryTab
  | NewTab
```

### BibleTab

```typescript
interface BibleTab extends TabBase {
  type: 'bible'
  data: {
    selectedVersion: VersionCode    // 'LSG', 'KJV', etc.
    selectedBook: Book
    selectedChapter: number
    selectedVerse: number
    parallelVersions: VersionCode[]
    temp: {                         // Sélection temporaire
      selectedBook: Book
      selectedChapter: number
      selectedVerse: number
    }
    selectedVerses: SelectedVerses  // Versets sélectionnés
    selectionMode: 'grid' | 'list'
    focusVerses?: (string | number)[]
    isSelectionMode: StudyNavigateBibleType | undefined
    isReadOnly: boolean
  }
}

interface Book {
  Numero: number                    // 1-66
  Nom: string                       // Ex: 'Genèse'
  Chapitres: number                 // Nombre de chapitres
}

type SelectedVerses = Record<string, boolean>
// Clé: "BOOK-CHAPTER-VERSE"
```

### SearchTab

```typescript
interface SearchTab extends TabBase {
  type: 'search'
  data: {
    searchValue: string
  }
}
```

### CompareTab

```typescript
interface CompareTab extends TabBase {
  type: 'compare'
  data: {
    selectedVerses: SelectedVerses
  }
}
```

### StrongTab

```typescript
interface StrongTab extends TabBase {
  type: 'strong'
  data: {
    book?: number
    reference?: string              // Ex: 'H1234' ou 'G5678'
    strongReference?: StrongReference
  }
}

interface StrongReference {
  Code: number
  Mot: string
  Phonetique?: string
  Definition?: string
  Origine?: string
  LSG?: string
  // ... autres champs
}
```

### Autres TabTypes

```typescript
interface NaveTab extends TabBase {
  type: 'nave'
  data: {
    name_lower?: string
    name?: string
  }
}

interface DictionaryTab extends TabBase {
  type: 'dictionary'
  data: { word?: string }
}

interface StudyTab extends TabBase {
  type: 'study'
  data: { studyId?: string }
}

interface NotesTab extends TabBase {
  type: 'notes'
  data: { noteId?: string }         // undefined = liste, défini = détail
}

interface CommentaryTab extends TabBase {
  type: 'commentary'
  data: { verse: string }           // "BOOK-CHAPTER-VERSE"
}

interface NewTab extends TabBase {
  type: 'new'
  data: {}
}
```

## État des plans (Redux)

### PlanState

```typescript
interface PlanState {
  myPlans: Plan[]                   // Plans téléchargés
  onlinePlans: {
    data: PlanSummary[]
    isFetching: boolean
  }
  ongoingPlans: OngoingPlan[]       // Progression
  images: Record<string, string>    // Cache URLs images
}
```

### Plan

```typescript
interface Plan {
  id: string
  title: string
  subTitle?: string
  image?: string                    // URL image couverture
  author: {
    id: string
    displayName: string
    photoUrl?: string
  }
  type: 'yearly' | 'meditation'
  lang: 'fr' | 'en'
  sections: Section[]
}

interface Section {
  id: string
  title: string
  readingSlices: ReadingSlice[]
}

interface ReadingSlice {
  id: string
  title?: string
  slices: EntitySlice[]
}

interface EntitySlice {
  type: 'Title' | 'Text' | 'Verse' | 'Chapter' | 'Video' | 'Image'
  title?: string
  text?: string
  viewMore?: string
  subType?: string                  // Ex: 'quote'
}
```

### OngoingPlan

```typescript
interface OngoingPlan {
  id: string                        // Plan ID
  status: 'Idle' | 'Next' | 'Progress' | 'Completed'
  readingSlices: OngoingSlice[]
  startedAt?: number
  completedAt?: number
}

interface OngoingSlice {
  id: string                        // ReadingSlice ID
  sectionId: string
  status: 'Idle' | 'Next' | 'Progress' | 'Completed'
  completedAt?: number
}
```

## Schémas SQLite

### Table: verses (Bible)

```sql
CREATE TABLE verses (
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,           -- 1-66
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE(book, chapter, verse)
);
```

### Table: strongs (Concordance)

```sql
CREATE TABLE strongs (
  id INTEGER PRIMARY KEY,
  Code INTEGER NOT NULL,           -- Numéro Strong
  Mot TEXT,                        -- Mot original
  Phonetique TEXT,
  Type TEXT,                       -- 'hebreu' | 'grec'
  Definition TEXT,
  Origine TEXT,
  LSG TEXT,                        -- Traduction LSG
  -- ... autres champs selon la base
);
```

### Table: concordance

```sql
CREATE TABLE concordance (
  id INTEGER PRIMARY KEY,
  strong_code INTEGER NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_position INTEGER,
  FOREIGN KEY (strong_code) REFERENCES strongs(Code)
);
```

## Structure Firestore

### Collection: users

```
users/{userId}
├── id: string
├── email: string
├── displayName: string
├── photoURL: string
├── provider: string
├── subscription?: string
├── bible: {
│   └── settings: BibleSettings
│   └── changelog: Record<date, boolean>
│ }
├── plan: OngoingPlan[]
│
├── bookmarks/                     # Subcollection
│   └── {bookmarkId}: Bookmark
│
├── highlights/                    # Subcollection
│   └── {verseKey}: Highlight
│
├── notes/                         # Subcollection
│   └── {verseKey}: Note
│
├── links/                         # Subcollection
│   └── {verseKey}: Link
│
├── tags/                          # Subcollection
│   └── {tagId}: Tag
│
├── strongsHebreu/                 # Subcollection (cache)
├── strongsGrec/                   # Subcollection (cache)
├── words/                         # Subcollection (cache)
└── naves/                         # Subcollection (cache)
```

### Collection: studies

```
studies/{studyId}
├── id: string
├── title: string
├── content: { ops: DeltaOperation[] }
├── created_at: number
├── modified_at: number
├── published: boolean
└── user: {
    ├── id: string
    ├── displayName: string
    └── photoUrl?: string
}
```

### Collection: changelog

```
changelog/{date}
├── date: string                   # YYYYMMDD
├── title: string
├── description: string
├── version?: string
└── features?: string[]
```

## Conventions de clés

### Références bibliques

| Format | Exemple | Description |
|--------|---------|-------------|
| `BOOK-CHAPTER-VERSE` | `1-1-1` | Genèse 1:1 |
| `BOOK-CHAPTER-VERSE/BOOK-CHAPTER-VERSE` | `1-1-1/1-1-3` | Genèse 1:1-3 |

### Codes livres

| Code | Livre | Code | Livre |
|------|-------|------|-------|
| 1 | Genèse | 40 | Matthieu |
| 2 | Exode | 41 | Marc |
| 3 | Lévitique | 42 | Luc |
| ... | ... | 43 | Jean |
| 19 | Psaumes | ... | ... |
| 20 | Proverbes | 66 | Apocalypse |

### Codes Strong

| Format | Exemple | Description |
|--------|---------|-------------|
| `H{number}` | `H1234` | Hébreu |
| `G{number}` | `G5678` | Grec |
