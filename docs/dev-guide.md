# Guide de Développement et Déploiement - Bible Strong

> Généré automatiquement le 2026-01-06

## Prérequis

| Outil | Version | Description |
|-------|---------|-------------|
| Node.js | 18+ | Runtime JavaScript |
| Yarn | 1.22+ | Gestionnaire de paquets |
| Expo CLI | Dernière | `npx expo` |
| EAS CLI | ≥14.2.0 | `npm install -g eas-cli` |
| Xcode | 15+ | Build iOS (macOS uniquement) |
| Android Studio | Dernière | Build Android |

## Installation

```bash
# Cloner le projet
git clone <repository-url>
cd bible-strong-app

# Installer les dépendances
yarn install

# Copier les fichiers d'environnement (si nécessaire)
cp .env.development .env
```

## Scripts NPM

### Développement

| Commande | Description |
|----------|-------------|
| `yarn start` | Démarre le serveur Expo avec dev client |
| `yarn android` | Lance sur émulateur/appareil Android |
| `yarn ios` | Lance sur simulateur/appareil iOS |

### Build EAS

| Commande | Environnement | Type | Description |
|----------|---------------|------|-------------|
| `yarn build:android:dev` | Development | APK | Build dev Android |
| `yarn build:android:staging` | Staging | APK | Build staging Android |
| `yarn build:android:prod` | Production | AAB | Build production Android (Play Store) |
| `yarn build:android:prod:apk` | Production | APK | Build production Android (APK direct) |
| `yarn build:ios:dev` | Development | IPA | Build dev iOS |
| `yarn build:ios:dev-sim` | Development | Simulator | Build dev iOS simulateur |
| `yarn build:ios:staging` | Staging | IPA | Build staging iOS |
| `yarn build:ios:prod` | Production | IPA | Build production iOS (App Store) |

### Qualité du code

| Commande | Description |
|----------|-------------|
| `yarn lint` | Vérifie le code avec ESLint |
| `yarn lint:fix` | Corrige automatiquement les erreurs ESLint |
| `yarn format` | Formate avec Prettier |
| `yarn format:check` | Vérifie le formatage |
| `yarn typecheck` | Vérifie les types TypeScript |
| `yarn test` | Lance les tests Jest |

### Utilitaires

| Commande | Description |
|----------|-------------|
| `yarn clean` | Supprime node_modules et caches, réinstalle |
| `yarn i18n` | Extrait les chaînes i18n |

## Environnements

### Configuration par environnement

| Environnement | Fichier | Bundle ID | Firebase |
|---------------|---------|-----------|----------|
| **Development** | `.env.development` | `com.smontlouis.biblestrong.dev` | `firebase/dev/` |
| **Staging** | `.env.staging` | `com.smontlouis.biblestrong.staging` | `firebase/staging/` |
| **Production** | `.env.production` | `com.smontlouis.biblestrong` | `firebase/prod/` |

### Variables d'environnement

```bash
# .env.development
APP_NAME="dev - Bible Strong"
IOS_GOOGLE_SERVICES_FILE="./firebase/dev/GoogleService-Info.plist"
ANDROID_GOOGLE_SERVICES_FILE="./firebase/dev/google-services.json"
BUNDLE_IDENTIFIER="com.smontlouis.biblestrong.dev"
EXPO_PUBLIC_SENTRY_DSN="<sentry-dsn>"
```

### Accès aux variables

```typescript
// Dans le code
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
```

## Configuration EAS Build

### eas.json

```json
{
  "cli": {
    "version": ">= 14.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "image": "latest" }
    },
    "development-simulator": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "staging": {
      "channel": "staging",
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "channel": "production"
    },
    "production-apk": {
      "channel": "production",
      "android": { "buildType": "apk" }
    }
  }
}
```

### Profils de build

| Profil | Distribution | Usage |
|--------|--------------|-------|
| `development` | Internal | Dev avec Expo Dev Client |
| `development-simulator` | Internal | Simulateur iOS |
| `staging` | Internal | Tests internes |
| `production` | Store | Publication App Store / Play Store |

## Configuration Metro

```javascript
// metro.config.js
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts,
    'db', 'sqlite',  // Bases de données SQLite
    'mp3',           // Audio
    'ttf', 'otf',    // Polices
    'png', 'jpg', 'jpeg',  // Images
    'json', 'txt', 'html', // Données
  ],
}

module.exports = config
```

## Configuration TypeScript

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "~assets/*": ["src/assets/*"],
      "~common/*": ["src/common/*"],
      "~features/*": ["src/features/*"],
      "~helpers/*": ["src/helpers/*"],
      "~navigation/*": ["src/navigation/*"],
      "~redux/*": ["src/redux/*"],
      "~themes/*": ["src/themes/*"],
      "~state/*": ["src/state/*"],
      "~i18n": ["i18n"]
    }
  }
}
```

### Utilisation

```typescript
// Avant (relatif)
import { Button } from '../../../common/ui/Button'

// Après (alias)
import { Button } from '~common/ui/Button'
```

## Workflow de développement

### 1. Développement local

```bash
# Démarrer le serveur de développement
yarn start

# Dans un autre terminal, lancer sur iOS
yarn ios

# Ou sur Android
yarn android
```

### 2. Test des changements

```bash
# Vérifier les types
yarn typecheck

# Vérifier le linting
yarn lint

# Lancer les tests
yarn test
```

### 3. Build de test

```bash
# Build staging pour tests internes
yarn build:android:staging
yarn build:ios:staging
```

### 4. Déploiement production

```bash
# Build production
yarn build:android:prod
yarn build:ios:prod

# Soumettre aux stores
eas submit --platform android
eas submit --platform ios
```

## Structure Firebase

### Environnements

```
firebase/
├── dev/                    # Développement
│   ├── google-services.json       # Android
│   └── GoogleService-Info.plist   # iOS
├── staging/                # Staging
│   └── ...
└── prod/                   # Production
    └── ...
```

### Services utilisés

| Service | Usage |
|---------|-------|
| **Authentication** | Email, Google, Apple Sign-In |
| **Firestore** | Sync données utilisateur |
| **Storage** | Audio Bible, médias |
| **Remote Config** | Feature flags |
| **Analytics** | Tracking événements |

## Bases de données SQLite

### Téléchargement des bases

Les bases de données sont téléchargées à la demande depuis Firebase Storage :

| Base | Chemin local | Taille |
|------|--------------|--------|
| `strong.sqlite` | `documentDirectory/SQLite/{lang}/` | ~35 MB |
| `dictionnaire.sqlite` | `documentDirectory/SQLite/{lang}/` | ~22 MB |
| `nave.sqlite` | `documentDirectory/SQLite/{lang}/` | ~7 MB |
| `tresor.sqlite` | `documentDirectory/SQLite/shared/` | ~5 MB |
| `mhy.sqlite` | `documentDirectory/SQLite/{lang}/` | ~6 MB |
| `interlineaire.sqlite` | `documentDirectory/SQLite/shared/` | Variable |

### Support multilingue

- Chemins séparés par langue : `SQLite/fr/`, `SQLite/en/`
- Bases partagées : `SQLite/shared/` (Trésor, Interlinéaire)

## Tests

### Framework

- **Jest** avec `jest-expo`
- Tests dans `__tests__/` ou `*.test.ts`

### Lancer les tests

```bash
# Tous les tests
yarn test

# Tests en mode watch
yarn test --watch

# Tests avec couverture
yarn test --coverage
```

## Débogage

### React Native Debugger

1. Installer React Native Debugger
2. Lancer l'app en mode debug
3. Ouvrir le menu développeur (shake ou Cmd+D)
4. Sélectionner "Debug with Chrome" ou "Open React Native Debugger"

### Redux DevTools

```typescript
// Intégré via redux-devtools-expo-dev-plugin
// Visible dans Expo Dev Tools en mode développement
```

### Sentry (Error Tracking)

- Configuré automatiquement via `@sentry/react-native`
- DSN dans les variables d'environnement
- Sourcemaps uploadés lors des builds EAS

## Mises à jour OTA

### Expo Updates

- Canal `staging` : Mises à jour de test
- Canal `production` : Mises à jour production

```bash
# Publier une mise à jour
eas update --channel production --message "Fix bug XYZ"
```

## Bonnes pratiques

### React Compiler

Le projet utilise React Compiler - **pas de memoization manuelle** :

```typescript
// NE PAS utiliser useMemo, useCallback, memo()
// Le compilateur optimise automatiquement
```

### Composants de layout

Préférer `Box`, `HStack`, `VStack` à `StyleSheet` :

```typescript
// Recommandé
<HStack p={16} gap={8}>
  <Box flex={1}><Text>Content</Text></Box>
</HStack>
```

### Reanimated 4

Préférer les CSS transitions aux animations manuelles :

```typescript
// Recommandé pour animations simples
<Animated.View
  style={{
    opacity: isVisible ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: 300,
  }}
/>
```

## Ressources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Firebase React Native](https://rnfirebase.io)
