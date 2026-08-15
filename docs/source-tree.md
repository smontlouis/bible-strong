# Source Tree

## Root

| Path | Purpose |
|---|---|
| `app/` | Expo Router routes. Most files route into feature screens. |
| `src/` | Application source. |
| `i18n/` | Translation setup and locale JSON files. |
| `firebase/` | Environment-specific Firebase config files. |
| `builds/` | Local development client artifacts when present. |
| `docs/` | Repo documentation and agent docs. |
| `.agents/skills/` | Repo-local Codex skills. |

## Important Root Files

| File | Purpose |
|---|---|
| `app/_layout.tsx` | Runtime root and provider tree. |
| `app/index.tsx` | Main app switcher route. |
| `package.json` | Scripts, dependencies, Expo/RN versions. |
| `app.config.ts` | Expo config and environment-sensitive native settings. |
| `eas.json` | EAS build profiles. |
| `babel.config.js` | Expo Babel config and import aliases. |
| `tsconfig.json` | TypeScript config and path aliases. |
| `AGENTS.md` | Instructions for coding agents. |
| `CONTEXT.md` | Product/domain context. |

## App Routes

Routes in `app/` use Expo Router. Examples:

- `app/(explore)/bible-view.tsx`
- `app/search.tsx`
- `app/downloads.tsx`
- `app/strong/index.tsx`
- `app/strong/concordance.tsx`
- `app/strong/entity.tsx`
- `app/(library)/dictionnaire.tsx`
- `app/(library)/studies.tsx`
- `app/(library)/timeline-home.tsx`

Legacy screen names are mapped in `src/navigation/routeMapping.ts` and typed in `src/navigation/type.ts`.

## Source Folders

| Path | Purpose |
|---|---|
| `src/features/` | Feature modules and screens. |
| `src/common/` | Shared UI, modals, typography, layout, error boundary. |
| `src/helpers/` | Storage, databases, Firebase, loaders, formatting, hooks, utilities. |
| `src/redux/` | Redux store, modules, middleware, selectors, migrations. |
| `src/state/` | Jotai atoms and local/persisted app state. |
| `src/themes/` | Theme color sets and theme builder. |
| `src/navigation/` | Route mapping and route param types. |
| `src/assets/` | Images, icons, fonts, and bundled assets. |

## Feature Map

| Feature | Purpose |
|---|---|
| `app-switcher` | Root workspace, tab groups, bottom nav, snapshots, new-tab flow. |
| `bible` | Main reading surface, Bible DOM, selectors, verse actions, annotations, audio footer, Strong, compare, resources. |
| `bookmarks` | Bookmark list and bookmark editing modal. |
| `search` | Bible search and search result navigation. |
| `resources` | Storage-independent Bible, Strong, dictionary, and Nave access contracts. |
| `lexique` | Strong lexicon list/detail surfaces and resource cards. Standalone secondary pages are routed under `app/strong/`. |
| `studies` | Study list/editor and study DOM support. |
| `notes` | Notes list/details. |
| `plans` | Reading plans, plan slices, progress. |
| `dictionnary` | Westphal dictionary list/detail/search widgets. |
| `nave` | Nave topical Bible resource. |
| `commentaries` | Commentary screens/cards. |
| `timeline` | Biblical timeline surfaces. |
| `onboarding` | First-run resource selection/download flow. |
| `feature-onboarding` | Feature-level onboarding modals. |
| `profile` | Account/profile/auth-adjacent screens. |
| `settings` | App settings and Bible display settings. |
| `audio` | Audio documentation; runtime audio UI mostly lives under `bible/footer`. |

## High-Traffic Files

| File | Why it matters |
|---|---|
| `src/features/bible/BibleViewer.tsx` | Central Bible orchestration. High blast radius. |
| `src/features/bible/BibleDOM/BibleDOMWrapper.tsx` | Bridge between native state and DOM-rendered Bible content. |
| `src/features/bible/BibleDOM/BibleDOMComponent.tsx` | DOM-side rendering controller. |
| `src/features/bible/hooks/useAnnotationMode.ts` | Word annotation state/actions. |
| `src/state/tabs.ts` | Tab groups, active tab, cached tabs, Bible tab actions. |
| `src/redux/modules/user.ts` | Main persisted user Bible state. |
| `src/redux/firestoreMiddleware.ts` | Cloud sync side effects. |
| `src/features/resources/strongLexiconAccess.ts` | Storage-independent access to modular Strong entries, morphology, relations, resources, and entities. |
| `src/helpers/mobileResourceCatalog.ts` | Validates and resolves the current mobile artifact catalog. |
| `src/helpers/strongBibleSidecar.ts` | Version-specific Strong index lifecycle and queries. |
| `src/helpers/interlinearBibleSidecar.ts` | Localized BHG interlinear index lifecycle and queries. |
| `src/helpers/strongLexiconModules.ts` | Core and optional Strong lexicon module lifecycle. |
| `src/helpers/databases.ts` | General database metadata and local paths; Strong/interlinear modules use dedicated helpers. |
| `src/helpers/downloadManager.ts` | Executes resource download/install items and their lifecycle callbacks. |
