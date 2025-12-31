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

### Building (Local EAS Builds)
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
```
src/
├── features/           # Feature modules (main application code)
│   ├── bible/          # Bible reading, Strong's, verse selection
│   ├── studies/        # Study notes and editor
│   ├── plans/          # Reading plans
│   ├── search/         # Bible search (online via Algolia, offline via Lunr)
│   ├── timeline/       # Biblical timeline
│   ├── nave/           # Nave's Topical Bible
│   ├── dictionnary/    # Bible dictionary
│   ├── lexique/        # Strong's lexicon browser
│   ├── commentaries/   # Bible commentaries
│   ├── bookmarks/      # Bookmark management
│   ├── audio/          # Audio playback
│   ├── home/           # Home screen
│   ├── settings/       # App settings and user preferences
│   ├── onboarding/     # First-time user experience
│   ├── app-switcher/   # Multi-tab management interface
│   └── tips/           # User tips/hints
├── common/             # Shared UI components
│   ├── ui/             # Base UI primitives
│   └── icons/          # Icon components
├── redux/              # Redux store and state management
│   ├── modules/        # Redux slices (user, plan)
│   │   └── user/       # User-related slices (highlights, notes, tags, etc.)
│   └── selectors/      # Memoized selectors
├── state/              # Jotai atoms (tabs, app state)
├── helpers/            # Utility functions and custom hooks
├── navigation/         # React Navigation setup
├── themes/             # Theme definitions (8 themes: light, dark, sepia, etc.)
└── assets/             # Static assets
    ├── bible_versions/ # Bible data and pericope files
    ├── fonts/          # Custom fonts (Literata, Eina)
    ├── images/         # Images and Lottie animations
    ├── plans/          # Reading plan data
    └── sounds/         # Audio files

i18n/                   # Internationalization
├── locales/
│   ├── fr/             # French translations
│   └── en/             # English translations

firebase/               # Firebase configs per environment
├── dev/
├── staging/
└── prod/
```

### Key Architectural Patterns

1. **Feature-Based Organization**: Each feature is self-contained with its own screens, components, and logic.

2. **State Management**:
   - **Redux Toolkit + Persist**: Global persistent state (user data, settings, highlights, notes)
   - **Jotai atoms**: Tab state, local UI state (`src/state/tabs.ts`)
   - **MMKV**: Fast key-value storage for Redux persist

3. **Multi-Tab Bible System**:
   - Managed via Jotai atoms in `src/state/tabs.ts`
   - Supports multiple concurrent tabs: Bible, Search, Compare, Strong's, Study, etc.
   - Tab types defined in `TabItem` union type

4. **Styling with Emotion**:
   - `@emotion/native` for styled components
   - Theme provided via `ThemeProvider` from `@emotion/react`
   - Access theme in components via `useTheme()` hook

5. **Path Aliases** (configured in `babel.config.js` and `tsconfig.json`):
   ```typescript
   import Component from '~common/Component'
   import { helper } from '~helpers/helper'
   import { selectUser } from '~redux/selectors/user'
   import { BibleTab } from '~state/tabs'
   ```

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
1. Obtain SQLite database for the version
2. Add version definition to `src/helpers/bibleVersions.ts`
3. Add to appropriate section in `versionsBySections`
4. Implement download logic if needed

### Working with Themes
```typescript
// Available themes: default, sepia, nature, sunset, dark, black, mauve, night
import getTheme from '~themes'
const theme = getTheme['dark']

// In components
const MyComponent = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  color: theme.colors.default,
}))
```

### Adding Custom Hooks
Place in `src/helpers/use*.ts` following existing patterns like `useAsync`, `useDisclosure`, `usePrevious`.

### Bottom Sheets
Use `@gorhom/bottom-sheet`:
```typescript
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useBottomSheet } from '~helpers/useBottomSheet'
```

## Important Notes

1. **Custom Dev Client**: This app requires `expo-dev-client`, not Expo Go
2. **WebView Content**: Bible and study content renders in WebViews - test on both platforms
3. **Offline First**: Core Bible reading works offline; sync happens when online
4. **Performance**: Uses FlashList for long lists, MMKV for fast storage
5. **Audio**: Background playback via `react-native-track-player`
6. **Notifications**: Local notifications via `@notifee/react-native`

## Excluded from TypeScript/Linting

These directories have separate build processes:
- `src/features/bible/bibleWebView/` - WebView bundle
- `src/features/studies/studiesWebView/` - WebView bundle
- `src/helpers/react-native-htmlview/vendor/` - Third-party code
