# Architecture - Bible Strong

> Généré automatiquement le 2026-01-06

## Vue d'ensemble

Bible Strong est une application mobile React Native/Expo pour l'étude de la Bible, ciblant principalement les utilisateurs francophones avec support anglais.

### Diagramme de haut niveau

```
┌─────────────────────────────────────────────────────────────────┐
│                        Bible Strong App                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   UI Layer  │  │  State Mgmt │  │     Data Layer          │ │
│  │             │  │             │  │                         │ │
│  │ React Native│  │ Redux       │◄─┤ SQLite (Bible, Strong)  │ │
│  │ Components  │  │ Jotai       │  │ Firestore (User data)   │ │
│  │ Navigation  │  │ MMKV       │  │ Firebase Storage        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────────────────┐ │
│  │                   Business Logic                           │ │
│  │  Features: Bible, Studies, Plans, Search, Lexique, etc.   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Firebase   │  │   Sentry    │                               │
│  │  Auth/DB    │  │   Errors    │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture des couches

### 1. Couche Présentation (UI)

```
┌────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
├────────────────────────────────────────────────────────────┤
│  Screens (90+)          │  Components (80+)                │
│  ├── BibleScreen        │  ├── ui/ (primitives)            │
│  ├── StudiesScreen      │  │   ├── Box, Stack              │
│  ├── PlansScreen        │  │   ├── Button, Text            │
│  ├── SearchScreen       │  │   └── Modal, Input            │
│  └── SettingsScreen     │  └── common/ (composites)        │
├────────────────────────────────────────────────────────────┤
│  Navigation (React Navigation 6)                            │
│  └── MainStackNavigator (45 routes)                        │
├────────────────────────────────────────────────────────────┤
│  Theming (Emotion + 8 thèmes)                              │
│  └── default, dark, sepia, mauve, nature, night, sunset    │
└────────────────────────────────────────────────────────────┘
```

### 2. Couche État (State Management)

```
┌────────────────────────────────────────────────────────────┐
│                      State Layer                            │
├────────────────────────────────────────────────────────────┤
│  Redux Toolkit                │  Jotai Atoms                │
│  ├── user (bookmarks,         │  ├── tabs (multi-tab state) │
│  │   highlights, notes,       │  ├── activeGroup            │
│  │   links, studies, tags)    │  ├── cachedTabIds           │
│  ├── plan (progression)       │  └── UI local state         │
│  └── settings                 │                             │
├────────────────────────────────────────────────────────────┤
│  Persistence                                                │
│  ├── MMKV (Redux Persist) - Fast key-value storage         │
│  └── atomWithAsyncStorage (Jotai persistence)              │
├────────────────────────────────────────────────────────────┤
│  Middleware                                                 │
│  ├── firestoreMiddleware - Auto-sync to cloud              │
│  ├── logMiddleware - Logging & Sentry                      │
│  └── thunk - Async actions                                 │
└────────────────────────────────────────────────────────────┘
```

### 3. Couche Données (Data)

```
┌────────────────────────────────────────────────────────────┐
│                       Data Layer                            │
├────────────────────────────────────────────────────────────┤
│  Local Storage                                              │
│  ├── SQLite (expo-sqlite)                                  │
│  │   ├── Bible versions (40+)                              │
│  │   ├── Strong concordance (Heb/Gr)                       │
│  │   ├── Dictionnaire Westphal                             │
│  │   ├── Nave thématique                                   │
│  │   ├── Références croisées (Trésor)                      │
│  │   ├── Commentaires Matthew Henry                        │
│  │   └── Interlinéaire                                     │
│  ├── MMKV - Redux persist, fast cache                      │
│  └── FileSystem - Downloaded assets                        │
├────────────────────────────────────────────────────────────┤
│  Cloud Storage (Firebase)                                   │
│  ├── Firestore                                             │
│  │   ├── users/{userId} - Settings, profile                │
│  │   ├── users/{userId}/bookmarks/* - Subcollection        │
│  │   ├── users/{userId}/highlights/* - Subcollection       │
│  │   ├── users/{userId}/notes/* - Subcollection            │
│  │   ├── users/{userId}/links/* - Subcollection            │
│  │   ├── users/{userId}/tags/* - Subcollection             │
│  │   └── studies/{studyId} - Études publiées               │
│  └── Storage - Audio Bible, media assets                   │
└────────────────────────────────────────────────────────────┘
```

## Patterns architecturaux

### 1. Feature-Based Organization

Chaque feature est un module autonome avec ses propres :
- Screens (écrans)
- Components (composants)
- Hooks (logique réutilisable)
- Types (TypeScript)

```
src/features/bible/
├── BibleScreen.tsx           # Point d'entrée
├── BibleTabScreen.tsx        # Tab wrapper
├── BibleViewer.tsx           # Orchestrateur
├── BibleHeader.tsx           # Header
├── BibleDOM/                 # WebView rendering
├── BookSelectorBottomSheet/  # Sélection livre
├── footer/                   # Audio controls
└── README.md                 # Documentation
```

### 2. Multi-Tab System

Architecture unique permettant plusieurs instances de Bible ouvertes simultanément.

```typescript
// Structure d'un groupe d'onglets
interface TabGroup {
  id: string
  name: string
  tabs: TabItem[]           // BibleTab, SearchTab, StudyTab, etc.
  activeTabIndex: number
}

// Jusqu'à 8 groupes, chaque groupe avec N onglets
const MAX_TAB_GROUPS = 8
```

**Flux de données :**
```
tabGroupsAtom (persisted)
    │
    ├── activeGroupIdAtom
    │       │
    │       └── activeGroupAtom (derived)
    │               │
    │               └── tabsAtom (tabs du groupe actif)
    │                       │
    │                       └── activeTabIndexAtom
    │
    └── cachedTabIdsAtom (LRU cache, max 5)
```

### 3. Middleware-Based Sync

Synchronisation automatique Redux → Firestore via middleware.

```typescript
// Flux de synchronisation
Redux Action (ADD_HIGHLIGHT)
    │
    ├── Reducer (met à jour l'état local)
    │
    └── firestoreMiddleware
            │
            ├── Calcule le diff (deep-obj)
            │
            ├── Identifie les subcollections impactées
            │
            └── Batch write vers Firestore
                    │
                    └── Retry avec token refresh si permission-denied
```

### 4. WebView Integration

Le texte biblique est rendu dans une WebView pour :
- Gestion complexe du texte (RTL hébreu, grec)
- Interlinéaire avec alignement
- Performance de scroll
- Sélection de texte native

```
BibleTabScreen
    │
    └── BibleViewer
            │
            ├── BibleHeader (navigation)
            │
            ├── BibleDOMWrapper (WebView)
            │       │
            │       ├── HTML/CSS généré
            │       │
            │       └── postMessage ↔ onMessage
            │           (communication bidirectionnelle)
            │
            └── AudioBar (contrôles)
```

## Flux de données

### 1. Lecture de la Bible

```
User selects verse
        │
        ▼
BookSelectorBottomSheet
        │
        ▼
useBibleTabActions.setSelectedBook/Chapter/Verse
        │
        ▼
tabAtom updated (Jotai)
        │
        ▼
BibleDOMWrapper re-renders
        │
        ▼
SQLite query for verses
        │
        ▼
HTML generated → WebView
```

### 2. Surlignage d'un verset

```
User long-press verse
        │
        ▼
SelectedVersesModal opens
        │
        ▼
User selects color
        │
        ▼
dispatch(addHighlight({ verseId, color }))
        │
        ├── Redux reducer updates state.user.bible.highlights
        │
        └── firestoreMiddleware
                │
                ├── Detects diff in highlights
                │
                └── batchWriteSubcollection('highlights', changes)
                        │
                        ▼
                    Firestore: users/{uid}/highlights/{verseId}
```

### 3. Synchronisation cloud

```
App startup
    │
    ├── Redux hydrated from MMKV
    │
    └── FireAuth.onAuthStateChanged
            │
            ▼
        User logged in?
            │
            ├── No → Local-only mode
            │
            └── Yes → Setup listeners
                    │
                    ├── onSnapshot(users/{uid}) → RECEIVE_LIVE_UPDATES
                    │
                    └── For each subcollection:
                        onSnapshot(users/{uid}/{collection})
                            │
                            └── RECEIVE_SUBCOLLECTION_UPDATES
```

## Modèles de données

### UserState (Redux)

```typescript
interface UserState {
  // Profile
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  subscription?: 'monthly' | 'yearly' | 'lifetime'

  // Bible data
  bible: {
    bookmarks: Record<string, Bookmark>
    highlights: Record<string, Highlight>
    notes: Record<string, Note>
    links: Record<string, Link>
    studies: Record<string, Study>
    tags: Record<string, Tag>
    settings: BibleSettings
  }
}
```

### TabItem Types

```typescript
type TabItem =
  | BibleTab      // Lecture Bible
  | SearchTab     // Recherche
  | CompareTab    // Comparaison
  | StrongTab     // Lexique
  | NaveTab       // Thématique
  | DictionaryTab // Dictionnaire
  | StudyTab      // Études
  | NotesTab      // Notes
  | CommentaryTab // Commentaires
  | NewTab        // Nouvel onglet
```

### Highlight

```typescript
interface Highlight {
  color: string           // 'color-69D2E7' ou hex
  tags: Record<string, boolean>
  date: number            // Timestamp
}

// Clé: "BOOK-CHAPTER-VERSE" ex: "1-1-1" (Gen 1:1)
```

## Sécurité

### Authentification

```
┌─────────────────────────────────────────┐
│           Authentication Flow            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  Email  │  │ Google  │  │  Apple  │ │
│  │Password │  │ Sign-In │  │ Sign-In │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       │            │            │       │
│       └────────────┼────────────┘       │
│                    │                    │
│                    ▼                    │
│           Firebase Auth                 │
│                    │                    │
│                    ▼                    │
│           TokenManager                  │
│       (refresh automatique)             │
│                    │                    │
│                    ▼                    │
│           Firestore Rules               │
│     (user can only access own data)     │
│                                         │
└─────────────────────────────────────────┘
```

### Règles Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      // Subcollections
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }
    }

    // Studies can be public if published
    match /studies/{studyId} {
      allow read: if resource.data.published == true
                  || request.auth.uid == resource.data.user.id;
      allow write: if request.auth.uid == resource.data.user.id;
    }
  }
}
```

## Performance

### Optimisations implémentées

| Technique | Description | Fichier |
|-----------|-------------|---------|
| **React Compiler** | Memoization automatique | `babel.config.js` |
| **FlashList** | Listes performantes | Composants de liste |
| **Lazy loading** | Chargement différé des chapitres | `BibleViewer` |
| **SQLite caching** | Cache des requêtes | `bibleStupidMemoize.ts` |
| **MMKV** | Storage ultra-rapide | `storage.ts` |
| **Tab caching** | LRU cache des onglets (max 5) | `tabs.ts` |
| **Diff-based sync** | Seules les modifications sont envoyées | `firestoreMiddleware.ts` |
| **Subcollections** | Évite de charger toutes les données | Architecture Firestore |

### Métriques cibles

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Startup (cold) | < 3s | Time to interactive |
| Navigation | < 100ms | Screen transition |
| Search | < 500ms | Results display |
| Sync | Background | Non-blocking |

## Extensibilité

### Ajouter une nouvelle feature

1. Créer le dossier `src/features/{feature-name}/`
2. Implémenter les screens et composants
3. Ajouter les routes dans `MainStackNavigator.tsx`
4. Ajouter les types dans `navigation/type.ts`
5. Si persistance nécessaire, ajouter le reducer Redux ou l'atom Jotai
6. Documenter dans `README.md`

### Ajouter un nouveau type d'onglet

1. Définir l'interface dans `src/state/tabs.ts` :
```typescript
export interface MyNewTab extends TabBase {
  type: 'myNew'
  data: { /* ... */ }
}
```

2. Ajouter au type union `TabItem`
3. Implémenter `getDefaultData` pour ce type
4. Créer le composant de rendu dans `TabScreen`

### Ajouter une base de données

1. Ajouter la configuration dans `databases.ts`
2. Créer le helper de requête dans `helpers/`
3. Ajouter le composant `waitFor{DB}` si téléchargement requis
4. Documenter les schémas

## Diagrammes supplémentaires

### Navigation

```
AppSwitcher (root)
    │
    ├── TabScreen (active tab)
    │       │
    │       ├── BibleTab → BibleViewer
    │       ├── SearchTab → SearchScreen
    │       ├── StudyTab → EditStudyScreen
    │       └── ...
    │
    └── MainStack (modal/push)
            │
            ├── MoreScreen (settings)
            ├── LoginScreen
            ├── StrongScreen
            ├── PlanScreen
            └── ... (45 routes)
```

### État global

```
┌─────────────────────────────────────────────────────────────┐
│                      Global State                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Redux Store                    Jotai Store                 │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │ user                │       │ tabGroupsAtom       │     │
│  │ ├── bible           │       │ activeGroupIdAtom   │     │
│  │ │   ├── bookmarks   │       │ activeTabIndexAtom  │     │
│  │ │   ├── highlights  │       │ cachedTabIdsAtom    │     │
│  │ │   ├── notes       │       │ appSwitcherModeAtom │     │
│  │ │   ├── links       │       │                     │     │
│  │ │   ├── studies     │       │ (+ atoms locaux     │     │
│  │ │   ├── tags        │       │  dans les features) │     │
│  │ │   └── settings    │       │                     │     │
│  │ └── notifications   │       └─────────────────────┘     │
│  │                     │                                   │
│  │ plan                │       Persistence:                │
│  │ └── ongoingPlans    │       ├── MMKV (Redux)            │
│  │                     │       └── atomWithAsyncStorage    │
│  └─────────────────────┘           (Jotai)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
