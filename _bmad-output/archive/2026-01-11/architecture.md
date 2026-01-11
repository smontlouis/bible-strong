---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - "_bmad-output/prd.md"
  - "docs/index.md"
workflowType: 'architecture'
project_name: 'bible-strong-app'
user_name: 'Stephane'
date: '2026-01-06'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (20 FRs) :**

Migration technique de React Navigation 6 vers Expo Router avec :
- Stack navigation uniquement (pas de TabNavigator)
- Routes légères dans `app/` (exports simples vers `src/features/`)
- AppSwitcherScreen gère la navigation principale en interne
- Infrastructure deep linking à configurer
- Système multi-onglets Jotai préservé

**Non-Functional Requirements (10 NFRs) :**

- Performance : Pas de dégradation vs baseline
- Compatibilité : iOS 13+, Android API 21+, Expo SDK 54
- Fiabilité : Crash rate stable, 100% routes testées

**Scale & Complexity :**

- Primary domain : Mobile App (React Native/Expo)
- Complexity level : Low-Medium (migration technique)
- Estimated components : 45+ routes, 1 layout principal

### Technical Constraints & Dependencies

| Contrainte | Impact |
|------------|--------|
| Expo SDK 54 | Version Expo Router compatible |
| React Native 0.81 | Pas de changement |
| TypeScript 5.9 | Typed routes Expo Router |
| Jotai pour tabs | Préservé, pas de modification |
| Redux + MMKV | Préservé, pas de modification |

### Cross-Cutting Concerns

1. **Deep linking** - Affecte toutes les routes
2. **TypeScript types** - Nouveau système de types pour routes
3. **Path aliases** - Doivent fonctionner dans `app/`
4. **Navigation params** - Migration vers useLocalSearchParams()

## Migration Pattern - Expo Router

### Existing Stack (Preserved)

| Technology | Version | Status |
|------------|---------|--------|
| React Native | 0.81 | Inchangé |
| Expo SDK | 54 | Inchangé |
| TypeScript | 5.9 | Inchangé |
| Emotion Native | - | Inchangé |
| Redux Toolkit | - | Inchangé |
| Jotai | - | Inchangé |
| React Navigation 6 | - | **À remplacer** |

### Migration Command

```bash
npx expo install expo-router expo-linking expo-constants
```

### Configuration Changes

**app.json :**
```json
{
  "expo": {
    "scheme": "biblestrong",
    "web": {
      "bundler": "metro"
    }
  }
}
```

**package.json :**
```json
{
  "main": "expo-router/entry"
}
```

### New Structure Added

```
app/
├── _layout.tsx          # Root Stack layout
├── index.tsx            # → AppSwitcherScreen
└── [routes...].tsx      # → exports from src/features/
```

### Preserved Structure

```
src/
├── features/            # Inchangé - logique métier
├── common/              # Inchangé - composants partagés
├── redux/               # Inchangé - state management
├── state/               # Inchangé - Jotai atoms
├── helpers/             # Inchangé - utilitaires
└── navigation/          # À supprimer après migration
```

## Core Architectural Decisions

### ADR-001: Route Structure - Nested by Route

**Decision:** Structure nested par domaine avec segments dynamiques

```
app/
├── _layout.tsx                              # Root Stack
├── index.tsx                                # → AppSwitcherScreen
├── bible/
│   ├── _layout.tsx                          # Bible stack (optionnel)
│   ├── [version]/
│   │   └── [book]/
│   │       └── [chapter].tsx                # → BibleScreen
├── strong/
│   ├── _layout.tsx                          # Strong stack (optionnel)
│   └── [id].tsx                             # → StrongScreen
├── plan/
│   ├── index.tsx                            # → PlanListScreen
│   └── [id]/
│       ├── index.tsx                        # → PlanDetailScreen
│       └── day/
│           └── [day].tsx                    # → PlanDayScreen
├── study/
│   ├── index.tsx                            # → StudyListScreen
│   └── [id].tsx                             # → StudyScreen
├── search.tsx                               # → SearchScreen
├── settings.tsx                             # → SettingsScreen
├── nave/
│   └── [id].tsx                             # → NaveScreen
├── dictionnary/
│   └── [word].tsx                           # → DictionnaryScreen
└── timeline.tsx                             # → TimelineScreen
```

**Rationale:**
- URLs sémantiques lisibles : `/bible/LSG/jean/3`
- Structure scalable pour futures features
- Deep links intuitifs pour marketing

### ADR-002: Navigation Parameters - Dynamic Segments

**Decision:** Paramètres via segments d'URL dynamiques

| Pattern | Exemple URL | Params |
|---------|-------------|--------|
| `bible/[version]/[book]/[chapter]` | `/bible/LSG/jean/3` | `{ version: 'LSG', book: 'jean', chapter: '3' }` |
| `strong/[id]` | `/strong/H1234` | `{ id: 'H1234' }` |
| `plan/[id]/day/[day]` | `/plan/yearly/day/42` | `{ id: 'yearly', day: '42' }` |

**Usage dans les screens:**

```typescript
// app/bible/[version]/[book]/[chapter].tsx
export { default } from '~features/bible/BibleScreen'

// src/features/bible/BibleScreen.tsx
import { useLocalSearchParams } from 'expo-router'

const BibleScreen = () => {
  const { version, book, chapter } = useLocalSearchParams<{
    version: string
    book: string
    chapter: string
  }>()
  // ...
}
```

**Navigation programmatique:**

```typescript
import { router } from 'expo-router'

// Push vers un verset
router.push('/bible/LSG/jean/3')

// Avec query params additionnels
router.push('/bible/LSG/jean/3?verse=16&highlight=true')

// Remplacer l'écran courant
router.replace('/bible/LSG/matthieu/1')
```

### ADR-003: Deep Linking - Universal Links (Web-Ready)

**Decision:** Universal Links iOS + App Links Android avec domaine web

**Configuration:**

```
Scheme custom:     biblestrong://bible/LSG/jean/3
Universal Links:   https://biblestrong.app/bible/LSG/jean/3
App Links:         https://biblestrong.app/bible/LSG/jean/3
```

**app.json:**

```json
{
  "expo": {
    "scheme": "biblestrong",
    "ios": {
      "associatedDomains": ["applinks:biblestrong.app"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "biblestrong.app",
              "pathPrefix": "/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**Routes prioritaires pour deep linking:**

| Route | URL | Usage |
|-------|-----|-------|
| Bible | `/bible/[version]/[book]/[chapter]` | Partage de versets |
| Strong | `/strong/[id]` | Étude de mots |
| Plan | `/plan/[id]/day/[day]` | Campagnes marketing |
| Study | `/study/[id]` | Partage d'études |

**Avantages:**
- Liens cliquables dans emails/SMS
- SEO-ready pour future version web
- Analytics tracking via UTM params

## Implementation Guidelines

### API Migration Reference

| React Navigation 6 | Expo Router | Notes |
|---------------------|-------------|-------|
| `NavigationContainer` | Supprimé | Géré automatiquement par Expo Router |
| `createNativeStackNavigator()` | `Stack` from `expo-router` | Dans `_layout.tsx` |
| `navigation.navigate('Screen', params)` | `router.push('/path')` | URL-based |
| `navigation.goBack()` | `router.back()` | Identique |
| `navigation.replace('Screen')` | `router.replace('/path')` | Identique |
| `navigation.reset()` | `router.replace('/')` | Reset vers root |
| `useNavigation()` | `useRouter()` | Import from `expo-router` |
| `useRoute()` | `useLocalSearchParams()` | Pour params |
| `route.params.id` | `params.id` | Via destructuring |
| `navigation.setOptions()` | `<Stack.Screen options={}>` | Dans layout ou screen |

### Root Layout Pattern

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bible/[version]/[book]/[chapter]" />
      <Stack.Screen name="strong/[id]" />
      <Stack.Screen name="plan/[id]" />
      <Stack.Screen name="settings" />
      {/* autres routes */}
    </Stack>
  )
}
```

### Screen File Pattern

Chaque fichier dans `app/` est un thin wrapper :

```typescript
// app/bible/[version]/[book]/[chapter].tsx
export { default } from '~features/bible/BibleScreen'
```

**Aucune logique dans `app/`** - tout reste dans `src/features/`.

### Screen Adaptation Pattern

```typescript
// AVANT - src/features/bible/BibleScreen.tsx
import { useNavigation, useRoute } from '@react-navigation/native'

const BibleScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { version, book, chapter } = route.params

  const goToStrong = (id: string) => {
    navigation.navigate('Strong', { id })
  }
}

// APRÈS - src/features/bible/BibleScreen.tsx
import { useRouter, useLocalSearchParams } from 'expo-router'

const BibleScreen = () => {
  const router = useRouter()
  const { version, book, chapter } = useLocalSearchParams<{
    version: string
    book: string
    chapter: string
  }>()

  const goToStrong = (id: string) => {
    router.push(`/strong/${id}`)
  }
}
```

### Provider Migration

```typescript
// AVANT - InitApp.tsx
import { NavigationContainer } from '@react-navigation/native'

const InitApp = () => (
  <ThemeProvider>
    <ReduxProvider>
      <NavigationContainer>
        <MainStackNavigator />
      </NavigationContainer>
    </ReduxProvider>
  </ThemeProvider>
)

// APRÈS - app/_layout.tsx
import { Stack } from 'expo-router'
import { ThemeProvider } from '~themes'
import { ReduxProvider } from '~redux'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ReduxProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ReduxProvider>
    </ThemeProvider>
  )
}
```

### TypeScript Types Migration

```typescript
// AVANT - src/navigation/type.ts
export type RootStackParamList = {
  Bible: { version: string; book: string; chapter: number }
  Strong: { id: string }
  Plan: { planId: string }
}

// APRÈS - src/navigation/type.ts (nouveau format)
import { Href } from 'expo-router'

// Types générés automatiquement par Expo Router
// ou définition manuelle des params:
export type BibleParams = {
  version: string
  book: string
  chapter: string
}

export type StrongParams = {
  id: string
}

// Helper pour typed navigation
export const routes = {
  bible: (params: BibleParams): Href =>
    `/bible/${params.version}/${params.book}/${params.chapter}`,
  strong: (id: string): Href => `/strong/${id}`,
} as const
```

## Files to Migrate

### Phase 1: Configuration

| File | Action |
|------|--------|
| `app.json` | Ajouter scheme, associatedDomains, intentFilters |
| `package.json` | Changer main vers `expo-router/entry` |
| `babel.config.js` | Vérifier compatibilité (probablement OK) |
| `tsconfig.json` | Vérifier paths (probablement OK) |

### Phase 2: Entry Points

| File | Action |
|------|--------|
| `App.tsx` | Simplifier - fonts loading seulement |
| `InitApp.tsx` | Supprimer NavigationContainer |
| `src/navigation/MainStackNavigator.tsx` | Migrer vers `app/_layout.tsx` |
| `src/navigation/type.ts` | Adapter pour Expo Router types |

### Phase 3: Create Routes

Créer structure `app/` basée sur les 45+ routes existantes.

### Phase 4: Update Screens

Migrer les imports navigation dans chaque screen de `src/features/`.

### Phase 5: Cleanup

| File | Action |
|------|--------|
| `src/navigation/MainStackNavigator.tsx` | Supprimer |
| `src/navigation/` (dossier) | Supprimer ou garder types seulement |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Params type mismatch | Medium | Valider tous les params sont strings |
| Deep link conflicts | Low | Tester sur devices physiques |
| Path alias issues | Low | Vérifier metro.config.js |
| Provider order | Low | Conserver même ordre que maintenant |

## Validation Checklist

- [ ] `yarn start` démarre sans erreur
- [ ] Navigation entre tous les écrans fonctionne
- [ ] Back button/gesture fonctionne
- [ ] Params passés correctement à tous les screens
- [ ] Multi-tabs Bible fonctionne (Jotai inchangé)
- [ ] Deep links fonctionnent sur iOS/Android
- [ ] `yarn typecheck` passe
- [ ] `yarn build:ios:prod` réussit
- [ ] `yarn build:android:prod` réussit
