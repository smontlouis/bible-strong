# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Strong is a React Native application for Bible study, primarily targeting French-speaking users but with English support. Key features include:

- **Multiple Bible translations**: 40+ versions in French, English, Hebrew, and Greek
- **Strong's concordance**: Hebrew and Greek word studies with interlinear versions
- **Reading plans**: Yearly and meditation-style plans with progress tracking
- **Study tools**: Notes, highlights, bookmarks, cross-references, and verse linking
- **Nave's Topical Bible**: Thematic Bible study reference
- **Audio Bible**: Streaming playback with background audio support
- **Timeline**: Biblical history visualization
- **Offline support**: Core functionality works without internet

**Tech Stack**: Expo SDK 54, React Native 0.81, TypeScript, Redux Toolkit, Jotai, Emotion, SQLite

## Essential Commands

### Development

```bash
yarn start              # Start Expo dev server with custom dev client
yarn android            # Run on Android device/emulator
yarn ios                # Run on iOS device/simulator
```

### Building

```bash
# Android
yarn build:android:dev       # Development build
yarn build:android:staging   # Staging APK
yarn build:android:prod      # Production AAB
yarn build:android:prod:apk  # Production APK

# iOS
yarn build:ios:dev           # Development build
yarn build:ios:dev-sim       # Simulator build
yarn build:ios:staging       # Staging build
yarn build:ios:prod          # Production build
```

### Code Quality

```bash
yarn lint                # ESLint check
yarn lint:fix            # ESLint auto-fix
yarn format              # Prettier format
yarn format:check        # Prettier check
yarn typecheck           # TypeScript type checking
yarn test                # Run Jest tests
yarn i18n                # Extract i18n strings
```

### Maintenance

```bash
yarn clean               # Remove node_modules and caches, reinstall
```

## Architecture

### Directory Structure

- `src/features/` - Feature-based modules (bible, studies, plans, search, timeline, etc.)
- `src/common/` - Shared UI components and utilities
- `src/redux/` - Redux store configuration and modules
- `src/helpers/` - Utility functions and custom hooks
- `src/themes/` - Theme definitions and colors
- `i18n/` - Internationalization files (French/English)
- `firebase/` - Environment-specific Firebase configurations

### Key Architectural Patterns

1. **Feature-Based Organization**: Each feature is self-contained with its own screens, components, and logic.

2. **State Management**:
   - **Redux Toolkit + Persist**: Global persistent state (user data, settings, highlights, notes)
   - **Jotai atoms**: Tab state, local UI state (`src/state/tabs.ts`)
   - **MMKV**: Fast key-value storage for Redux persist

3. **Multi-Tab Bible System**: Custom tab management allowing multiple Bible instances open simultaneously (`src/features/bible/BibleTabScreen.tsx`).

4. **WebView Integration**: Bible content is rendered in WebViews with custom JavaScript interfaces for interactions (`src/features/bible/bibleWebView/`).

5. **Path Aliases**: Use these imports for cleaner code:
   - `~features/` instead of relative paths
   - `~common/`, `~helpers/`, `~redux/`, etc.

### Environment Configuration

The app uses environment-based builds with different Firebase configurations:

- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

### Data Storage

| Data Type | Storage | Location |
|-----------|---------|----------|
| Bible versions | SQLite | `documentDirectory/SQLite/` (downloaded) |
| Strong's concordance | SQLite | `documentDirectory/SQLite/` |
| User highlights/notes | Redux + Firestore | MMKV persist + cloud sync |
| Tab state | Jotai + MMKV | Async storage atoms |
| App settings | Redux | MMKV persist |

### Firebase Integration

- **Authentication**: Email/password, Google, Apple Sign-In
- **Firestore**: Cloud sync for user data (highlights, notes, studies, tags)
- **Remote Config**: Feature flags (e.g., `enable_tts_public`)
- **Analytics**: Screen tracking, user events
- **Storage**: Bible audio files, study assets

## Key Files Reference

| File | Purpose |
|------|---------|
| `App.tsx` | App entry, font loading, splash screen |
| `InitApp.tsx` | Provider tree setup (Theme, Redux, Navigation) |
| `src/state/tabs.ts` | Tab state atoms and Bible tab actions |
| `src/redux/store.ts` | Redux store configuration with persist |
| `src/redux/modules/user.ts` | User state slice |
| `src/navigation/MainStackNavigator.tsx` | All screen routes |
| `src/helpers/bibleVersions.ts` | Bible version definitions |
| `src/helpers/databases.ts` | SQLite database helpers |
| `src/themes/index.ts` | Theme definitions |

## Development Guidelines

### Component Patterns

```typescript
// Typical screen component
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { useSelector, useDispatch } from 'react-redux'

const MyScreen = () => {
  const theme = useTheme()
  const dispatch = useDispatch()
  const userData = useSelector(state => state.user)

  return (
    <Container>
      {/* content */}
    </Container>
  )
}

const Container = styled.View(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.lightGrey,
}))
```

### State Management Rules

1. **Use Redux for**:
   - User data that syncs with Firestore
   - Persistent settings
   - Data shared across many screens

2. **Use Jotai for**:
   - Tab state and navigation state
   - Ephemeral UI state
   - Component-local state that needs to be shared

3. **Firestore Sync**: Redux middleware (`firestoreMiddleware.ts`) automatically syncs user actions to Firestore when logged in.

### Bible Data Access

```typescript
import { getDatabases } from '~helpers/databases'
import { getSQLTransaction } from '~helpers/getSQLTransaction'

// Get database reference
const databases = getDatabases()
const db = databases.BIBLE

// Execute query
const transaction = await getSQLTransaction(db)
const result = await transaction.executeSql('SELECT * FROM verses WHERE book = ?', [1])
```

### Adding a New Screen

1. Create screen component in appropriate `src/features/` directory
2. Add route to `src/navigation/MainStackNavigator.tsx`
3. Add type to `src/navigation/type.ts`
4. Navigate using: `navigation.navigate('ScreenName', { params })`

### i18n Usage

```typescript
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t } = useTranslation()
  return <Text>{t('key.path')}</Text>
}
```

Translation files: `i18n/locales/{fr,en}/translation.json`

## Testing

- Framework: Jest with `jest-expo`
- Limited test coverage currently
- Run: `yarn test`

## Environment Configuration

Three environments configured via `.env.*` files:

- **Development** (`.env.development`): Debug builds, dev Firebase
- **Staging** (`.env.staging`): Internal testing, staging Firebase
- **Production** (`.env.production`): App store releases, prod Firebase

Environment variables accessed via `process.env.EXPO_PUBLIC_*`

## Common Tasks

### Adding a New Bible Version

1. Add the SQLite database file to `src/assets/bible_versions/`
2. Update the version list in the appropriate configuration
3. Test offline functionality

### Modifying Bible Display

- Edit files in `src/features/bible/bibleWebView/src/`
- Run the development server to see changes
- Test text selection, highlighting, and note-taking features

### Working with Themes

- Theme definitions are in `src/themes/`
- User theme preferences are stored in Redux under `user.bible.settings.theme`
- Use the `useTheme` hook to access current theme colors

## Reanimated 4 Best Practices

Le projet utilise **React Native Reanimated 4.x**. Voici les bonnes pratiques à suivre :

### Accesseurs SharedValue

Pour compatibilité avec React Compiler, utiliser `.get()` et `.set()` au lieu de `.value` :

```typescript
// ❌ Ancienne API (encore supportée mais non recommandée)
const sv = useSharedValue(0)
sv.value = 100
console.log(sv.value)

// ✅ Nouvelle API recommandée (compatible React Compiler)
const sv = useSharedValue(0)
sv.set(100)
sv.set(v => v + 50)  // avec callback
console.log(sv.get())
```

### useAnimatedStyle

```typescript
const animatedStyle = useAnimatedStyle(() => {
  return {
    opacity: interpolate(scrollX.get(), [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: scrollX.get() }],
  }
})
```

### Règles importantes

1. **Ne jamais lire/modifier les SharedValues pendant le render** - utiliser callbacks (`useAnimatedStyle`, `useEffect`)
2. **Éviter les mutations dans `useAnimatedStyle`** - peut causer des boucles infinies
3. **Les styles animés ont priorité** sur les styles statiques
4. **Utiliser `interpolate` avec `Extrapolation.CLAMP`** pour limiter les valeurs
5. **Préférer les propriétés non-layout** (`transform`, `opacity`) aux propriétés layout (`top`, `width`)

### Documentation

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
