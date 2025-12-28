# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Strong is a React Native application for Bible study in French, featuring Strong's concordance, reading plans, study notes, and various Bible translations. It's built with Expo SDK 52 and supports both iOS and Android platforms.

## Essential Commands

### Development

```bash
# Start development server
yarn start

# Run on local devices/simulators
yarn android  # Run on Android device/emulator
yarn ios      # Run on iOS device/simulator
```

### Building

```bash
# Android builds (local)
yarn build:android:dev      # Development build
yarn build:android:staging  # Staging build
yarn build:android:prod     # Production build
yarn build:android:prod:apk # Production APK

# iOS builds (local)
yarn build:ios:dev          # Development build
yarn build:ios:dev-sim      # Development simulator build
yarn build:ios:staging      # Staging build
yarn build:ios:prod         # Production build
```

### Code Quality

```bash
# Run linting
yarn lint

# Run tests (limited test coverage)
yarn test

# Extract i18n strings
yarn i18n
```

### Maintenance

```bash
# Clean and reinstall dependencies
yarn clean
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

1. **Feature-Based Organization**: Each major feature has its own directory under `src/features/` containing components, screens, and related logic.

2. **State Management**:
   - Redux Toolkit for global state (user data, Bible versions, settings)
   - Jotai atoms for local component state
   - Redux-persist for offline storage

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

### Database Structure

- SQLite databases for Bible versions stored in `src/assets/bible_versions/`
- Strong's concordance data in `src/assets/strong/`
- User data synced with Firestore

### Important Technical Details

1. **Custom Expo Dev Client**: The app uses a custom development build, not Expo Go.

2. **Audio Playback**: Bible audio uses `react-native-track-player` with background playback support.

3. **Offline Support**: Core Bible functionality works offline using local SQLite databases.

4. **Deep Linking**: Configured for Firebase Auth and Google Sign-in redirects.

5. **Push Notifications**: Implemented using Notifee for local notifications.

6. **Theme System**: Dynamic theming with user-customizable colors stored in Redux.

## Development Tips

1. **Testing WebView Changes**: Bible and study content is rendered in WebViews. Test changes in both iOS and Android as WebView behavior can differ.

2. **Working with Bible Data**: Bible versions are SQLite databases. Use the `getDatabasesRef` helper to access them.

3. **Adding New Features**: Follow the existing pattern in `src/features/` - create a new directory with components, screens, and any feature-specific logic.

4. **State Updates**: For user-related data that needs persistence, use Redux actions. For UI-only state, prefer Jotai atoms.

5. **Performance**: The app uses `@shopify/flash-list` for performant lists and `react-native-mmkv` for fast key-value storage.

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
