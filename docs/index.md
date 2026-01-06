# Documentation - Bible Strong

> Documentation de référence pour le développement assisté par IA
> Généré automatiquement le 2026-01-06

## Vue d'ensemble du projet

**Bible Strong** est une application mobile React Native / Expo pour l'étude biblique, principalement destinée aux utilisateurs francophones avec support anglais.

| Attribut | Valeur |
|----------|--------|
| **Type** | Application Mobile |
| **Framework** | React Native 0.81 + Expo SDK 54 |
| **Langage** | TypeScript 5.9 |
| **Plateformes** | iOS, Android |
| **Architecture** | Monolithe feature-based |

### Fonctionnalités principales

- **40+ traductions bibliques** (français, anglais, hébreu, grec)
- **Concordance Strong** avec versions interlinéaires
- **Plans de lecture** annuels et méditations
- **Outils d'étude** : notes, surlignages, favoris, liens
- **Bible thématique Nave**
- **Bible audio** avec lecture en arrière-plan
- **Timeline** historique biblique
- **Mode hors-ligne** complet

## Index de la documentation

### Documents principaux

| Document | Description | Usage |
|----------|-------------|-------|
| [Architecture](./architecture.md) | Architecture système, patterns, flux de données | Comprendre la structure globale |
| [Guide de développement](./dev-guide.md) | Scripts, environnements, déploiement | Configurer et builder le projet |
| [Arbre source](./source-tree.md) | Structure des dossiers annotée | Naviguer dans le code |
| [Modèles de données](./data-models.md) | Interfaces TypeScript, schémas | Comprendre les entités |
| [Conventions](./conventions.md) | Patterns de code, bonnes pratiques | Écrire du code conforme |

### Documentation existante

| Document | Description |
|----------|-------------|
| [README.md](../README.md) | Présentation du projet (français) |
| [README.en.md](../README.en.md) | Présentation du projet (anglais) |
| [CLAUDE.md](../CLAUDE.md) | Instructions pour Claude Code |

### Documentation par feature

| Feature | Fichier | Description |
|---------|---------|-------------|
| Bible | [README.md](../src/features/bible/README.md) | Lecteur biblique multi-onglets |
| Studies | [README.md](../src/features/studies/README.md) | Éditeur d'études |
| Plans | [README.md](../src/features/plans/README.md) | Plans de lecture |
| Search | [README.md](../src/features/search/README.md) | Recherche Algolia/Lunr |
| Timeline | [README.md](../src/features/timeline/README.md) | Frise historique |
| Dictionary | [README.md](../src/features/dictionnary/README.md) | Dictionnaire biblique |
| Nave | [README.md](../src/features/nave/README.md) | Bible thématique |
| Onboarding | [README.md](../src/features/onboarding/README.md) | Écrans d'introduction |
| Audio | [README.md](../src/features/audio/README.md) | Lecture audio |
| Settings | [README.md](../src/features/settings/README.md) | Paramètres utilisateur |

## Stack technologique

### Core

| Technologie | Version | Usage |
|-------------|---------|-------|
| React Native | 0.81 | Framework mobile |
| Expo | SDK 54 | Tooling et services |
| TypeScript | 5.9 | Typage statique |
| React | 19.1.0 | Composants UI |

### Gestion d'état

| Technologie | Usage |
|-------------|-------|
| Redux Toolkit | État persistant global |
| Jotai | État UI et onglets |
| Redux Persist + MMKV | Persistance locale |

### UI & Navigation

| Technologie | Usage |
|-------------|-------|
| Emotion Native | Styled components |
| React Navigation 6 | Navigation |
| Reanimated 4 | Animations |
| FlashList | Listes performantes |

### Données

| Technologie | Usage |
|-------------|-------|
| expo-sqlite | Bases locales |
| Firebase Firestore | Sync cloud |
| Algolia + Lunr.js | Recherche |

## Commandes essentielles

```bash
# Développement
yarn start              # Serveur Expo
yarn ios                # Lancer iOS
yarn android            # Lancer Android

# Build
yarn build:ios:prod     # Build production iOS
yarn build:android:prod # Build production Android

# Qualité
yarn typecheck          # Vérification TypeScript
yarn lint               # ESLint
yarn test               # Tests Jest
```

## Patterns clés

### React Compiler

Le projet utilise React Compiler - **pas de memoization manuelle** :

```typescript
// INTERDIT
const memoized = useMemo(() => value, [deps])

// CORRECT
const value = computeValue()
```

### Composants de layout

```typescript
// PRÉFÉRER
<HStack flex={1} p={16} gap={8}>
  <Box bg="primary"><Text>Content</Text></Box>
</HStack>

// ÉVITER
<View style={styles.container}>...</View>
```

### Path aliases

```typescript
// CORRECT
import { Button } from '~common/ui/Button'

// ÉVITER
import { Button } from '../../../common/ui/Button'
```

## Architecture simplifiée

```
┌─────────────────────────────────────────────────────────┐
│                    App (InitApp.tsx)                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │               Providers                              ││
│  │  ThemeProvider → ReduxProvider → NavigationContainer ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  Redux   │    │  Jotai   │    │  SQLite  │
     │  Store   │    │  Atoms   │    │  DBs     │
     └────┬─────┘    └────┬─────┘    └────┬─────┘
          │               │               │
          ▼               ▼               ▼
     ┌─────────────────────────────────────────┐
     │            Feature Modules              │
     │  bible │ studies │ plans │ search │ ... │
     └─────────────────────────────────────────┘
                            │
                            ▼
     ┌─────────────────────────────────────────┐
     │              Firestore Sync             │
     │        (firestoreMiddleware.ts)         │
     └─────────────────────────────────────────┘
```

## Flux de données principal

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   UI Event   │─────▶│   Action     │─────▶│   Reducer    │
│  (onPress)   │      │  (dispatch)  │      │  (Immer)     │
└──────────────┘      └──────────────┘      └──────┬───────┘
                                                   │
      ┌────────────────────────────────────────────┘
      │
      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    State     │─────▶│  Middleware  │─────▶│  Firestore   │
│   Updated    │      │   (sync)     │      │   (cloud)    │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Structure des dossiers

```
bible-strong-app/
├── src/
│   ├── features/          # Modules par fonctionnalité
│   │   ├── bible/         # Lecteur biblique
│   │   ├── studies/       # Éditeur d'études
│   │   ├── plans/         # Plans de lecture
│   │   └── ...
│   ├── common/            # Composants partagés
│   ├── redux/             # Store et modules Redux
│   ├── state/             # Atoms Jotai
│   ├── helpers/           # Utilitaires
│   ├── themes/            # Thèmes et couleurs
│   └── navigation/        # Configuration navigation
├── i18n/                  # Traductions (fr, en)
├── firebase/              # Configs par environnement
└── docs/                  # Cette documentation
```

## Points d'entrée importants

| Fichier | Description |
|---------|-------------|
| `App.tsx` | Point d'entrée, chargement polices |
| `InitApp.tsx` | Arbre de providers |
| `src/redux/store.ts` | Configuration Redux |
| `src/state/tabs.ts` | Gestion des onglets Bible |
| `src/navigation/MainStackNavigator.tsx` | 45 routes |

## Contacts et ressources

- **Expo Docs**: https://docs.expo.dev
- **React Native**: https://reactnative.dev
- **Firebase RN**: https://rnfirebase.io

---

*Documentation générée automatiquement par le workflow document-project*
