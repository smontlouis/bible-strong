# Tech-Spec: Migration Redux → Redux Toolkit

**Created:** 2026-01-11
**Status:** Ready for Development

## Overview

### Problem Statement

Le code Redux actuel utilise des patterns legacy (createStore, switch/case reducers, action type constants manuels) qui sont verbeux et plus difficiles à maintenir. Redux Toolkit (RTK) est le standard moderne recommandé par l'équipe Redux.

### Solution

Migration big-bang de tout le code Redux vers Redux Toolkit :
- `store.ts` : `createStore` → `configureStore`
- Sub-modules user : `produce + switch/case` → `createSlice`
- `firestoreMiddleware.ts` : matching sur strings → matching sur action creators RTK
- Tests : mise à jour pour utiliser les nouveaux patterns

### Scope (In/Out)

**In scope :**
- `src/redux/store.ts`
- `src/redux/modules/user.ts`
- `src/redux/modules/user/*.ts` (9 sub-modules)
- `src/redux/firestoreMiddleware.ts`
- `src/redux/modules/__tests__/*.ts` (11 fichiers de tests)

**Out of scope :**
- `src/redux/modules/plan.ts` (déjà RTK)
- `src/redux/migrations.ts` (inchangé)
- `src/redux/logMiddleware.ts` (inchangé)

## Context for Development

### Codebase Patterns

**Pattern actuel (à remplacer) :**
```typescript
// Action types manuels
export const ADD_BOOKMARK = 'user/ADD_BOOKMARK'

// Reducer avec Immer produce + switch/case
export default produce((draft, action) => {
  switch (action.type) {
    case ADD_BOOKMARK: {
      draft.bible.bookmarks[action.payload.id] = action.payload
      break
    }
  }
})

// Action creators manuels
export function addBookmark(bookmark: Bookmark) {
  return { type: ADD_BOOKMARK, payload: bookmark }
}
```

**Pattern cible (RTK) :**
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const bookmarksSlice = createSlice({
  name: 'user/bookmarks',
  initialState: {} as BookmarksObj,
  reducers: {
    addBookmark(state, action: PayloadAction<Bookmark>) {
      state[action.payload.id] = action.payload
    },
  },
})

export const { addBookmark } = bookmarksSlice.actions
export default bookmarksSlice.reducer
```

**Architecture spéciale - State imbriqué :**

Le state user a une structure imbriquée `user.bible.bookmarks`, `user.bible.highlights`, etc.
Les sub-reducers actuels opèrent sur `draft.bible.xxx`.

**Approche RTK retenue :**
Créer des slices pour chaque domaine avec `initialState` correspondant à leur portion du state, puis les combiner dans le reducer user principal en utilisant `extraReducers` pour réagir aux actions des sub-slices.

### Files to Reference

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/redux/store.ts` | Config store | 63 |
| `src/redux/modules/reducer.ts` | Root reducer | 24 |
| `src/redux/modules/user.ts` | User reducer principal | 770 |
| `src/redux/modules/user/bookmarks.ts` | Sub-reducer bookmarks | 73 |
| `src/redux/modules/user/highlights.ts` | Sub-reducer highlights | 84 |
| `src/redux/modules/user/notes.ts` | Sub-reducer notes | ~60 |
| `src/redux/modules/user/links.ts` | Sub-reducer links | ~80 |
| `src/redux/modules/user/tags.ts` | Sub-reducer tags | ~100 |
| `src/redux/modules/user/settings.ts` | Sub-reducer settings | ~150 |
| `src/redux/modules/user/studies.ts` | Sub-reducer studies | ~100 |
| `src/redux/modules/user/customColors.ts` | Sub-reducer colors | ~50 |
| `src/redux/modules/user/versionUpdate.js` | Sub-reducer version | ~80 |
| `src/redux/firestoreMiddleware.ts` | Sync Firestore | 687 |
| `src/redux/modules/plan.ts` | Plan slice (référence RTK) | 263 |

### Technical Decisions

1. **Namespace des actions** : Garder le préfixe `user/` pour compatibilité avec les logs/analytics existants.

2. **Structure des slices** : Chaque sub-module devient un slice indépendant. Le state shape reste identique pour éviter de casser les migrations redux-persist.

3. **Gestion du state imbriqué** : Utiliser `extraReducers` dans le slice user principal pour intégrer les actions des sub-slices.

4. **Thunks** : Convertir les thunks manuels en `createAsyncThunk` où applicable, sinon garder comme fonctions thunk classiques (RTK supporte les deux).

5. **Middleware Firestore** : Utiliser `isAnyOf()` et les action matchers RTK au lieu du switch/case sur strings.

6. **Rétro-compatibilité** : Les action types générés par RTK (`user/bookmarks/addBookmark`) diffèrent des anciens (`user/ADD_BOOKMARK`). Le middleware et les tests doivent être mis à jour en conséquence.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Convertir store.ts**
  - Remplacer `createStore + applyMiddleware` par `configureStore`
  - Garder les middlewares existants (logger, crashReporter, firestoreMiddleware, thunk)
  - Conserver la config redux-persist

- [ ] **Task 2 : Créer les slices pour les sub-modules**
  - `bookmarksSlice` : 4 actions (add, remove, update, move)
  - `highlightsSlice` : 3 actions (add, remove, changeColor)
  - `notesSlice` : 2 actions (add, remove)
  - `linksSlice` : 3 actions (add, update, remove)
  - `tagsSlice` : 4 actions (add, remove, update, toggleEntity)
  - `settingsSlice` : ~15 actions (display, theme, share settings)
  - `studiesSlice` : 4 actions (create, update, delete, publish)
  - `customColorsSlice` : 3 actions (add, update, delete)
  - `versionUpdateSlice` : 2 thunks (getVersionUpdate, getDatabaseUpdate)

- [ ] **Task 3 : Refactorer user.ts**
  - Convertir en `createSlice`
  - Actions propres : login, logout, updateProfile, notifications, changelog, etc.
  - Utiliser `extraReducers` pour intégrer les sub-slices
  - Supprimer `reduceReducers` et le pattern de composition actuel

- [ ] **Task 4 : Mettre à jour firestoreMiddleware.ts**
  - Importer les action creators des nouveaux slices
  - Remplacer le switch/case par des matchers RTK (`isAnyOf`, `.match()`)
  - Pattern :
    ```typescript
    if (addBookmark.match(action) || removeBookmark.match(action)) {
      // sync bookmarks
    }
    ```

- [ ] **Task 5 : Mettre à jour les tests**
  - Remplacer les imports des action type constants par les action creators
  - Tester les reducers avec `slice.reducer` et les actions générées
  - Adapter les assertions si les action types changent

- [ ] **Task 6 : Vérifier les exports et les usages**
  - Grep tous les imports des anciens action types
  - Mettre à jour les composants qui dispatchent des actions
  - Vérifier que redux-persist fonctionne (même state shape)

- [ ] **Task 7 : Tests finaux et validation**
  - `yarn typecheck` - pas d'erreurs TS
  - `yarn test` - tous les tests passent
  - `yarn lint` - pas de warnings
  - Test manuel de l'app (login, bookmarks, highlights, sync Firestore)

### Acceptance Criteria

- [ ] **AC 1 :** `yarn typecheck` passe sans erreurs
- [ ] **AC 2 :** `yarn test` - tous les 11 fichiers de tests passent
- [ ] **AC 3 :** `yarn lint` passe sans erreurs
- [ ] **AC 4 :** L'app démarre et les données redux-persist sont chargées correctement
- [ ] **AC 5 :** Les actions CRUD (bookmarks, highlights, notes) fonctionnent
- [ ] **AC 6 :** La synchronisation Firestore fonctionne (ajout/suppression sync vers cloud)
- [ ] **AC 7 :** Le login/logout fonctionnent correctement
- [ ] **AC 8 :** Aucune régression sur les fonctionnalités existantes

## Additional Context

### Dependencies

- `@reduxjs/toolkit` : déjà installé (utilisé par plan.ts)
- `redux-persist` : compatible avec RTK, aucun changement nécessaire
- `immer` : intégré dans RTK, les imports explicites peuvent être supprimés des slices

### Testing Strategy

1. **Approche TDD inversée** : Garder les tests existants comme spec, les adapter après chaque conversion de slice
2. **Tests unitaires** : Tester chaque slice isolément avec son reducer et actions
3. **Tests d'intégration** : Vérifier le middleware Firestore avec les nouvelles actions
4. **Test manuel** : Scénarios critiques (login → add bookmark → sync → logout → login → verify data)

### Risques et Mitigations

| Risque | Mitigation |
|--------|------------|
| Action types différents cassent le middleware | Mettre à jour middleware en même temps que les slices |
| redux-persist ne reconnaît pas le state | Garder exactement le même state shape |
| Thunks avec getState cassent | Typer correctement avec RootState |
| Tests flaky | Mocker Date.now() pour les tests avec timestamps |

### Notes

- Le fichier `plan.ts` sert de référence pour le pattern RTK cible
- Les migrations redux-persist (version 30) ne sont pas affectées car le state shape ne change pas
- Supprimer le fichier `utils.js` à la fin (`reduceReducers` ne sera plus utilisé, `removeEntityInTags` peut être déplacé dans le slice tags)

### Ordre de migration recommandé

1. `store.ts` (fondation)
2. `customColorsSlice` (le plus simple, bon pour valider le pattern)
3. `bookmarksSlice` (simple, bien testé)
4. `notesSlice`, `linksSlice` (similaires)
5. `highlightsSlice` (utilise `removeEntityInTags`)
6. `tagsSlice` (dépendance de highlights)
7. `settingsSlice` (beaucoup d'actions mais simples)
8. `studiesSlice`
9. `versionUpdateSlice` (thunks)
10. `user.ts` (composition finale)
11. `firestoreMiddleware.ts` (adaptation aux nouvelles actions)
12. Tests (en parallèle avec chaque slice)
