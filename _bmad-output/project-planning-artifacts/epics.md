---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/prd.md"
  - "_bmad-output/architecture.md"
workflowType: 'epics-and-stories'
project_name: 'bible-strong-app'
user_name: 'Stephane'
date: '2026-01-06'
---

# bible-strong-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bible-strong-app, decomposing the requirements from the PRD and Architecture into implementable stories for the React Navigation 6 → Expo Router migration.

## Requirements Inventory

### Functional Requirements

**Navigation Core:**
- FR1: L'utilisateur peut naviguer entre tous les écrans existants via Expo Router (Stack)
- FR2: L'utilisateur peut utiliser le bouton/geste back pour revenir à l'écran précédent
- FR3: Le système peut gérer les routes dynamiques (bible/[version], strong/[id], etc.)

**AppSwitcher (Navigation principale):**
- FR4: AppSwitcherScreen gère les "tabs" visuels en interne (Bible/Search/Home/Plans)
- FR5: Le système Jotai gère l'état de navigation interne à AppSwitcher (inchangé)
- FR6: L'utilisateur peut basculer entre les vues via l'UI AppSwitcher (inchangé)

**Système Multi-Onglets Bible:**
- FR7: L'utilisateur peut ouvrir plusieurs onglets Bible simultanément (Jotai, inchangé)
- FR8: L'utilisateur peut basculer entre les onglets Bible ouverts
- FR9: L'utilisateur peut fermer un onglet Bible
- FR10: Le système persiste l'état des onglets entre sessions

**Deep Linking (Infrastructure):**
- FR11: Le système peut recevoir et traiter des URLs entrantes (scheme biblestrong://)
- FR12: Le système peut router vers l'écran approprié depuis une URL
- FR13: Le système peut extraire les paramètres d'URL et les passer à l'écran cible
- FR14: Le système peut gérer les Universal Links (iOS) et App Links (Android)

**Paramètres de Navigation:**
- FR15: Les écrans peuvent recevoir des paramètres via useLocalSearchParams()
- FR16: Les paramètres complexes sont sérialisés/désérialisés correctement

**Structure de Code:**
- FR17: Les fichiers dans `app/` contiennent uniquement l'import/export du screen
- FR18: La logique des screens reste dans `src/features/`
- FR19: Les path aliases (~features/) fonctionnent depuis `app/`

**Préservation des Features:**
- FR20: Toutes les fonctionnalités existantes restent fonctionnelles après migration

### NonFunctional Requirements

**Performance:**
- NFR1: Temps de navigation entre écrans ≤ temps actuel
- NFR2: Temps de démarrage de l'app ≤ temps actuel
- NFR3: Utilisation mémoire ≤ utilisation actuelle
- NFR4: Taille du bundle ≤ +5% vs actuel

**Compatibilité:**
- NFR5: iOS minimum supporté iOS 13+ (inchangé)
- NFR6: Android minimum supporté API 21+ (inchangé)
- NFR7: Expo SDK compatible SDK 54

**Fiabilité:**
- NFR8: Crash rate ≤ baseline actuel
- NFR9: Deep links fonctionnels - 100% des routes testées
- NFR10: Back navigation fonctionne sur tous les écrans

### Additional Requirements

**From Architecture - Migration Setup:**
- Installation: `npx expo install expo-router expo-linking expo-constants`
- app.json: Ajouter scheme "biblestrong", associatedDomains, intentFilters
- package.json: Changer main vers "expo-router/entry"
- Structure: Routes nested par domaine avec segments dynamiques (ADR-001)
- Params: Dynamic segments pour paramètres (ADR-002)
- Deep Links: Universal Links iOS + App Links Android (ADR-003)

**From Architecture - Migration Phases:**
- Phase 1: Configuration (app.json, package.json, babel, tsconfig)
- Phase 2: Entry Points (App.tsx, InitApp.tsx, _layout.tsx)
- Phase 3: Create Routes (structure app/ avec 45+ routes)
- Phase 4: Update Screens (migration imports dans src/features/)
- Phase 5: Cleanup (supprimer src/navigation/)

**From Architecture - Patterns:**
- Fichiers app/*.tsx = thin wrappers (export only)
- Aucune logique dans app/ - tout reste dans src/features/
- Migration API: useNavigation() → useRouter(), route.params → useLocalSearchParams()

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Navigation de base via Expo Router |
| FR2 | Epic 2 | Back button/gesture |
| FR3 | Epic 2 | Routes dynamiques |
| FR4 | Epic 1 | AppSwitcher gère tabs internes |
| FR5 | Epic 1 | Jotai état navigation (inchangé) |
| FR6 | Epic 1 | Basculer entre vues AppSwitcher |
| FR7 | Epic 2 | Multi-onglets Bible |
| FR8 | Epic 2 | Basculer onglets Bible |
| FR9 | Epic 2 | Fermer onglet Bible |
| FR10 | Epic 2 | Persistance onglets |
| FR11 | Epic 3 | URLs entrantes (scheme) |
| FR12 | Epic 3 | Routing depuis URL |
| FR13 | Epic 3 | Extraction params URL |
| FR14 | Epic 3 | Universal/App Links |
| FR15 | Epic 2 | useLocalSearchParams() |
| FR16 | Epic 2 | Sérialisation params |
| FR17 | Epic 1 | Fichiers app/ thin wrappers |
| FR18 | Epic 1 | Logique dans src/features/ |
| FR19 | Epic 1 | Path aliases fonctionnels |
| FR20 | Epic 2 | Toutes features préservées |

## Epic List

### Epic 1: Migration Foundation
**Goal:** L'app démarre avec Expo Router et la navigation de base fonctionne

L'utilisateur peut ouvrir l'app, voir l'écran d'accueil (AppSwitcher), et les providers sont correctement initialisés. C'est le socle minimal pour valider que la migration est viable.

**FRs couverts:** FR1, FR4, FR5, FR6, FR17, FR18, FR19

**Scope:**
- Installation expo-router, expo-linking, expo-constants
- Configuration app.json (scheme), package.json (main entry)
- Création `app/_layout.tsx` avec providers
- Création `app/index.tsx` → AppSwitcherScreen
- Path aliases fonctionnels depuis app/

---

### Epic 2: Complete Route Migration
**Goal:** Toutes les 45+ routes sont migrées et fonctionnelles

L'utilisateur peut naviguer vers tous les écrans existants, utiliser le back button/gesture, et toutes les features (Bible, Plans, Strong, etc.) fonctionnent identiquement.

**FRs couverts:** FR2, FR3, FR7, FR8, FR9, FR10, FR15, FR16, FR20

**Scope:**
- Création de tous les fichiers routes dans `app/`
- Migration des imports navigation dans tous les screens
- Paramètres via useLocalSearchParams()
- Système multi-onglets Bible préservé
- Validation exhaustive de chaque route

---

### Epic 3: Deep Linking & Cleanup
**Goal:** Les deep links fonctionnent et le code legacy est supprimé

Le système peut recevoir des URLs entrantes et router vers l'écran approprié. La migration est complète avec suppression de l'ancien code navigation.

**FRs couverts:** FR11, FR12, FR13, FR14

**Scope:**
- Configuration Universal Links (iOS) - associatedDomains
- Configuration App Links (Android) - intentFilters
- Test deep links sur devices physiques
- Suppression `src/navigation/MainStackNavigator.tsx`
- Cleanup du dossier `src/navigation/`

---

## Epic 1: Migration Foundation

**Goal:** L'app démarre avec Expo Router et la navigation de base fonctionne

### Story 1.1: Install Expo Router and Configure Entry Point

**As a** developer,
**I want** Expo Router installed and configured as the app entry point,
**So that** the app can use file-based routing.

**Acceptance Criteria:**

**Given** the current React Navigation 6 setup
**When** I run `npx expo install expo-router expo-linking expo-constants`
**Then** the dependencies are installed without conflicts
**And** package.json has `"main": "expo-router/entry"`
**And** app.json has `"scheme": "biblestrong"`
**And** `yarn start` runs without errors (even if app crashes - routes not yet created)

---

### Story 1.2: Create Root Layout with Providers

**As a** developer,
**I want** a root layout that wraps the app with all necessary providers,
**So that** theme, Redux, and other contexts are available to all screens.

**Acceptance Criteria:**

**Given** Expo Router is configured
**When** I create `app/_layout.tsx` with providers from InitApp.tsx
**Then** the layout exports a Stack navigator with `headerShown: false`
**And** ThemeProvider wraps the entire app
**And** Redux Provider (with persist) wraps the entire app
**And** all existing providers are preserved in correct order
**And** `yarn typecheck` passes

---

### Story 1.3: Create Index Route for AppSwitcher

**As a** user,
**I want** to see the home screen when opening the app,
**So that** I can access Bible, Search, Home, and Plans tabs.

**Acceptance Criteria:**

**Given** the root layout is configured
**When** I create `app/index.tsx` that exports AppSwitcherScreen
**Then** the app launches and shows AppSwitcherScreen
**And** the 4 internal "tabs" (Bible/Search/Home/Plans) are visible
**And** switching between tabs works (Jotai state preserved)
**And** path alias `~features/` works from `app/` directory
**And** `yarn start` launches the app successfully on iOS/Android simulator

---

## Epic 2: Complete Route Migration

**Goal:** Toutes les 45+ routes sont migrées et fonctionnelles

### Story 2.1: Create Bible Routes

**As a** user,
**I want** to access all Bible-related screens,
**So that** I can read, compare, and study Bible verses.

**Routes:** BibleView, BibleVerseNotes, BibleVerseLinks, BibleCompareVerses, ToggleCompareVerses, Strong, Concordance, ConcordanceByBook, Pericope, History, Commentaries (11 routes)

**Acceptance Criteria:**

**Given** Epic 1 is complete
**When** I create route files in `app/` for all Bible screens
**Then** `app/bible-view.tsx` → BibleViewScreen
**And** `app/strong/[id].tsx` → StrongScreen
**And** `app/concordance.tsx` → ConcordanceScreen
**And** all 11 Bible routes are accessible via `router.push()`
**And** back navigation works on all screens

---

### Story 2.2: Create Study & Search Routes

**As a** user,
**I want** to access study and search screens,
**So that** I can create studies and search the Bible.

**Routes:** Studies, EditStudy, Lexique, Search, LocalSearch (5 routes)

**Acceptance Criteria:**

**Given** Bible routes are created
**When** I create route files for study and search screens
**Then** `app/studies.tsx`, `app/study/[id].tsx`, `app/search.tsx`, etc. exist
**And** all 5 routes are accessible
**And** search results navigation works correctly

---

### Story 2.3: Create Dictionary & Nave Routes

**As a** user,
**I want** to access dictionary and Nave screens,
**So that** I can look up word definitions and topical studies.

**Routes:** Dictionnaire, DictionnaryDetail, Nave, NaveDetail, NaveWarning (5 routes)

**Acceptance Criteria:**

**Given** previous routes are created
**When** I create route files for dictionary and Nave
**Then** `app/dictionnaire.tsx`, `app/nave/[id].tsx`, etc. exist
**And** all 5 routes are accessible with correct params

---

### Story 2.4: Create Plans Routes

**As a** user,
**I want** to access reading plan screens,
**So that** I can follow and manage my Bible reading plans.

**Routes:** Plans, Plan, MyPlanList, PlanSlice (4 routes)

**Acceptance Criteria:**

**Given** previous routes are created
**When** I create route files for plans
**Then** `app/plans.tsx`, `app/plan/[id].tsx`, `app/plan-slice.tsx` exist
**And** all 4 routes are accessible
**And** plan navigation (list → detail → slice) works correctly

---

### Story 2.5: Create Settings Routes

**As a** user,
**I want** to access all settings and account screens,
**So that** I can configure the app and manage my account.

**Routes:** More, Home, Login, Register, ForgotPassword, Profile, Support, CustomHighlightColors, Changelog, ImportExport, Backup, AutomaticBackups, Downloads, FAQ, BibleShareOptions, ResourceLanguage, BibleDefaults, Theme (18 routes)

**Acceptance Criteria:**

**Given** previous routes are created
**When** I create route files for all settings screens
**Then** all 18 settings routes exist in `app/`
**And** login/register flow works correctly
**And** nested settings navigation works

---

### Story 2.6: Create Tags & Bookmarks Routes

**As a** user,
**I want** to access my tags, bookmarks, and highlights,
**So that** I can organize and find my saved content.

**Routes:** Tags, Tag, Highlights, Bookmarks (4 routes)

**Acceptance Criteria:**

**Given** previous routes are created
**When** I create route files for tags and bookmarks
**Then** `app/tags.tsx`, `app/tag/[id].tsx`, `app/bookmarks.tsx`, `app/highlights.tsx` exist
**And** all 4 routes are accessible with correct params

---

### Story 2.7: Create Timeline Routes

**As a** user,
**I want** to access the biblical timeline,
**So that** I can explore history visually.

**Routes:** Timeline, TimelineHome (2 routes)

**Acceptance Criteria:**

**Given** previous routes are created
**When** I create route files for timeline
**Then** `app/timeline.tsx` and `app/timeline-home.tsx` exist
**And** timeline gestures work correctly

---

### Story 2.8: Migrate Navigation Imports in All Screens

**As a** developer,
**I want** all screens to use Expo Router hooks,
**So that** navigation is consistent throughout the app.

**Acceptance Criteria:**

**Given** all route files are created
**When** I update all screens in `src/features/`
**Then** `useNavigation()` is replaced by `useRouter()`
**And** `useRoute()` is replaced by `useLocalSearchParams()`
**And** `navigation.navigate()` is replaced by `router.push()`
**And** `navigation.goBack()` is replaced by `router.back()`
**And** `yarn typecheck` passes with no navigation-related errors

---

### Story 2.9: Validate Multi-Tab Bible System

**As a** user,
**I want** the multi-tab Bible system to work exactly as before,
**So that** I can have multiple Bible tabs open simultaneously.

**Acceptance Criteria:**

**Given** all routes and screens are migrated
**When** I test the multi-tab Bible system
**Then** I can create new Bible tabs
**And** I can switch between tabs
**And** I can close tabs
**And** tab state persists between app restarts
**And** Jotai state management works unchanged

---

## Epic 3: Deep Linking & Cleanup

**Goal:** Les deep links fonctionnent et le code legacy est supprimé

### Story 3.1: Configure iOS Universal Links

**As a** user on iOS,
**I want** to open Bible Strong links from Safari/Messages/Email,
**So that** shared links take me directly to the right screen.

**Acceptance Criteria:**

**Given** Epic 2 is complete
**When** I configure iOS Universal Links in app.json
**Then** `associatedDomains` includes `applinks:biblestrong.app`
**And** the Apple App Site Association file is configured on server
**And** clicking `https://biblestrong.app/strong/H1234` opens the app on iOS
**And** the app navigates to the correct Strong screen

---

### Story 3.2: Configure Android App Links

**As a** user on Android,
**I want** to open Bible Strong links from Chrome/Messages/Email,
**So that** shared links take me directly to the right screen.

**Acceptance Criteria:**

**Given** iOS Universal Links are configured
**When** I configure Android App Links in app.json
**Then** `intentFilters` are configured for `biblestrong.app`
**And** Digital Asset Links file is configured on server
**And** clicking `https://biblestrong.app/strong/H1234` opens the app on Android
**And** the app navigates to the correct Strong screen

---

### Story 3.3: Test Deep Links on Physical Devices

**As a** developer,
**I want** to verify all deep link routes work correctly,
**So that** users have a reliable experience with shared links.

**Acceptance Criteria:**

**Given** Universal Links and App Links are configured
**When** I test deep links on physical iOS and Android devices
**Then** `biblestrong://` scheme URLs work
**And** `https://biblestrong.app/` URLs work
**And** Bible routes with params work (`/bible/LSG/jean/3`)
**And** Strong routes work (`/strong/H1234`)
**And** Plan routes work (`/plan/yearly`)
**And** invalid routes show appropriate fallback

---

### Story 3.4: Remove Legacy Navigation Code

**As a** developer,
**I want** to remove all React Navigation 6 code,
**So that** the codebase is clean and maintainable.

**Acceptance Criteria:**

**Given** all deep links are tested and working
**When** I remove legacy navigation code
**Then** `src/navigation/MainStackNavigator.tsx` is deleted
**And** `src/navigation/type.ts` is updated or deleted
**And** `@react-navigation/*` packages are removed from package.json (except if needed by other deps)
**And** all `@react-navigation` imports are removed from codebase
**And** `yarn typecheck` passes
**And** `yarn build:ios:prod` succeeds
**And** `yarn build:android:prod` succeeds
