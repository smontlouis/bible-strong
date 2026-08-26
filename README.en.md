<p align="center">
  <a href="./README.md">🇫🇷 Version française</a>
</p>

<h1 align="center">
  <img width="120" height="120" src="https://raw.githubusercontent.com/smontlouis/bible-strong/master/apps/mobile/assets/images/icon.png"><br>
  <a href="https://bible-strong.app"><span>Bible Strong</span></a><br>
</h1>

<p align="center">
  <a href="https://play.google.com/apps/testing/com.smontlouis.biblestrong">Android beta</a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://testflight.apple.com/join/Wh1Wz8Zb">iOS beta</a>
</p>

<p align="center">
  <strong>Discover the Bible in a new light</strong><br>
  <em>A complete Bible study application with Strong's concordance</em>
</p>

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://img.shields.io/badge/App_Store-available-blue?logo=apple&logoColor=white" alt="App Store" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://img.shields.io/badge/Google_Play-available-green?logo=google-play&logoColor=white" alt="Google Play" />
  </a>
  <br/>
  <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=white" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-SDK_54-000020?logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <a href="https://github.com/smontlouis/bible-strong/releases">
    <img src="https://img.shields.io/github/v/tag/smontlouis/bible-strong?label=version" alt="Version" />
  </a>
</p>

---

## About

**Bible Strong** is a free and open-source mobile application for in-depth Bible study. Designed primarily for the French-speaking community but with English support, it offers powerful tools to explore biblical texts in their original languages (Hebrew and Greek) through Strong's concordance.

Whether you are a theology student, pastor, or simply curious to deepen your understanding of the Scriptures, Bible Strong gives you access to resources usually reserved for specialists, all in a modern and intuitive interface.

## Download the App

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="50" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="50" />
  </a>
</p>

## Main Features

### Bible Reading

- **40+ translations** available in French, English, Hebrew, and Greek
  - French: LSG 1910, Segond 21, NEG79, NBS, Semeur, Darby, Martin, Chouraqui...
  - English: KJV, ESV, NIV, NKJV, NLT, NASB...
  - Original languages: BHS (Hebrew), Septuagint, Textus Receptus (Greek)
- **Tab system** to navigate between multiple passages simultaneously
- **Parallel mode** to compare different versions side by side
- **8 visual themes**: light, sepia, nature, sunset, dark, black, mauve, night
- **Customization**: font size, font family, line spacing

### Strong's Concordance

Strong's concordance allows you to study each word of the Bible in its original language:

- **Separate text and indexes**: a Bible remains readable without Strong data; its lexical index can be installed or updated independently
- **Many compatible Bibles**: LSG, Darby, KJV, NASB, BSB, and other publications have their own concordance
- **Modular lexicon**: the Hebrew/Greek core can be extended with a detailed Greek dictionary and biblical entity profiles
- **Precise lexical identities**: support for classic Strong's numbers and enriched STEPBible identities
- **Contextual concordance**: browse occurrences, original forms, transliteration, and available morphology
- **Enriched navigation**: explore related words, entities, lexical resources, and study relations

### Original Languages and Interlinear

- **BHG Hebrew-Greek Bible**: canonical original-language text covering the Old and New Testaments
- **French and English interlinear indexes**: glosses, transliteration, morphology, and lexical alignment without duplicating the Bible text
- **Configurable display**: original text, interlinear translation, Strong's numbers, and transliteration can be adapted to the reading context

### Study Tools

- **Colored highlighting**: mark important verses with customizable colors
- **Personal notes**: add your reflections to each verse
- **Bookmarks**: quickly find your favorite passages
- **Tags**: organize your verses by custom themes
- **Verse links**: create connections between related passages
- **Studies**: write complete studies with rich text editor
- **History**: find recently viewed verses

### References and Resources

- **Nave's Bible**: thematic index of the Bible with thousands of entries
- **Bible dictionary**: definitions of terms, places, and characters
- **Treasury of Scripture**: cross-references for each verse
- **Bible commentaries**: insights on passages

### Reading Plans

- **Annual plans**: read the Bible in one year with different methods
- **Thematic plans**: explore specific topics
- **Guided meditations**: content with texts, videos, and reflections
- **Progress tracking**: visualize your advancement
- **Bible Project integration**: plans associated with Bible Project videos

### Audio

- **Audio Bible**: listen to the Bible in several versions
- **Background playback**: continue listening even with the screen off
- **Speed control**: adjust playback speed
- **Text-to-speech**: listen to any version with TTS

### Biblical Timeline

- **Interactive timeline**: visualize the history of the Bible
- **Major events**: from creation to the early church
- **Intuitive navigation**: move through time easily

### Sync and Backup

- **User account**: sign in with Google or Apple
- **Cloud sync**: access your data on all your devices
- **Automatic backup**: never lose your notes and highlights
- **Offline library**: choose which Bibles, lexicons, Strong indexes, and resources remain on the device
- **Guided installation**: the startup Bible is guaranteed while additional resources are organized by purpose

## Screenshots

*Available on the [App Store](https://apps.apple.com/fr/app/bible-strong/id1454738221) and [Play Store](https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong)*

---

## Bible Strong Monorepo

This repository brings together the Bible Strong applications, services, and shared packages in a single Yarn 4 workspace:

| Workspace | Package | Role |
|-----------|---------|------|
| `apps/mobile` | `@bible-strong/mobile` | Expo / React Native application presented in this README |
| `apps/web` | `@bible-strong/web` | Bible Strong web application |
| `apps/api` | `@bible-strong/api` and `@bible-strong/api-functions` | API and Firebase functions |
| `apps/lexicon-editor` | `@bible-strong/lexicon-editor` | Editorial production of lexicons and resources |
| `packages/resource-service` | `@bible-strong/resource-service` | Publication and delivery of Bible resources |
| `packages/resource-domain` | `@bible-strong/resource-domain` | Shared resource contracts and invariants |
| `packages/resource-catalog` | `@bible-strong/resource-catalog` | Shared catalog of published resources |
| `packages/bible-reference-parser` | `@bible-strong/bible-reference-parser` | French and English Bible reference parsing |

All dependencies are resolved from the repository root with a single `yarn.lock`. Dependencies between workspaces use the `workspace:*` protocol, and shared Yarn patches remain under `.yarn/patches`.

See [`CONTEXT-MAP.md`](./CONTEXT-MAP.md) for the domain contexts and [`docs/index.md`](./docs/index.md) for the documentation index.

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher; Node 22 is recommended for EAS previews)
- [Yarn](https://yarnpkg.com/) v4 (managed via Corepack)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (provided by the mobile workspace)
- [EAS CLI](https://docs.expo.dev/eas/) for builds
- For iOS: macOS with Xcode 15+
- For Android: Android Studio with an emulator or physical device

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/smontlouis/bible-strong.git
   cd bible-strong
   ```

2. **Enable Corepack for Yarn 4**
   ```bash
   corepack enable
   ```

3. **Install dependencies**
   ```bash
   yarn install
   ```

4. **Configure environment variables**

   The `.env.*` files under `apps/mobile/` are required for the app to work.
   Use `apps/mobile/.env.example` as a starting point.
   You will need your own Firebase keys for local development.

5. **Create a development build**

   This application requires a custom development client (not Expo Go).

   ```bash
   # For Android
   yarn workspace @bible-strong/mobile build:android:dev

   # For iOS (macOS only)
   yarn workspace @bible-strong/mobile build:ios:dev

   # For iOS simulator
   yarn workspace @bible-strong/mobile build:ios:dev-sim
   ```

6. **Start the development server**
   ```bash
   yarn dev:mobile
   ```

7. **Run on a device**
   ```bash
   # Android
   yarn workspace @bible-strong/mobile android

   # iOS
   yarn workspace @bible-strong/mobile ios
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev:mobile` | Start the mobile Expo server |
| `yarn dev:web` | Start the web application |
| `yarn dev:api` | Start the local Firebase API |
| `yarn dev:lexicon` | Start the lexicon editorial tooling |
| `yarn dev:resources` | Start the Resource service |
| `yarn lint` | Check configured workspaces with ESLint |
| `yarn typecheck` | Check TypeScript types across all workspaces |
| `yarn test` | Run the monorepo test suites |
| `yarn build` | Build the API and web applications |
| `yarn format:check` | Check mobile application formatting |
| `yarn workspace @bible-strong/mobile android` | Run the mobile app on Android |
| `yarn workspace @bible-strong/mobile ios` | Run the mobile app on iOS |
| `yarn workspace @bible-strong/mobile lint:fix` | Automatically fix mobile lint errors |
| `yarn workspace @bible-strong/mobile format` | Format mobile code with Prettier |
| `yarn workspace @bible-strong/mobile clean` | Clean and reinstall mobile dependencies |
| `yarn workspace @bible-strong/mobile i18n` | Extract mobile translation strings |

### Production Builds

```bash
# Android
yarn workspace @bible-strong/mobile build:android:staging    # Internal test build (APK)
yarn workspace @bible-strong/mobile build:android:prod       # Production build (AAB)
yarn workspace @bible-strong/mobile build:android:prod:apk   # Production build (APK)

# iOS
yarn workspace @bible-strong/mobile build:ios:staging        # Internal test build
yarn workspace @bible-strong/mobile build:ios:prod           # Production build
```

---

## Contributing

Contributions are welcome! Bible Strong is an open-source community project.

### How to Contribute

#### Report a Bug

1. Check that the bug has not already been reported in [Issues](https://github.com/smontlouis/bible-strong/issues)
2. Create a new issue describing:
   - Steps to reproduce the bug
   - Expected behavior vs observed behavior
   - Your device, OS version, and app version
   - Screenshots if possible

#### Propose a Feature

1. Open an [Issue](https://github.com/smontlouis/bible-strong/issues) to discuss your idea
2. Describe the need and proposed solution
3. Wait for validation before starting development

#### Submit Code

1. **Fork** the repository
2. Create a branch for your change:
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/bug-fix
   ```
3. Make your changes following project conventions
4. Ensure code passes checks:
   ```bash
   yarn lint
   yarn typecheck
   ```
5. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add a new feature"
   git commit -m "fix: fix navigation bug"
   git commit -m "docs: update documentation"
   ```
6. Push your branch:
   ```bash
   git push origin feature/my-feature
   ```
7. Open a **Pull Request** with a clear description of changes

### Code Conventions

- **TypeScript**: strict typing enabled, avoid `any`
- **ESLint**: Expo + Prettier configuration
- **Styling**: prefer `Box`, `HStack`, and `VStack`; Emotion remains available for shared primitives
- **State**: Redux for persistent data, Jotai for local UI
- **Commits**: Conventional Commits format
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation
  - `refactor:` refactoring without functional change
  - `style:` formatting, no code change
  - `test:` adding or modifying tests
  - `chore:` maintenance, dependencies

### Translations

Want to help translate the app?

Translation files are in `apps/mobile/i18n/locales/`:
- `apps/mobile/i18n/locales/fr/translation.json` - French (main language)
- `apps/mobile/i18n/locales/en/translation.json` - English

To add a new language:
1. Create a new folder in `apps/mobile/i18n/locales/`
2. Copy `apps/mobile/i18n/locales/fr/translation.json` as a base
3. Translate the values (not the keys)
4. Open a PR

---

## Project Architecture

```
bible-strong/
├── apps/
│   ├── mobile/                         # Expo / React Native application
│   │   ├── app/                        # Expo Router routes
│   │   │   └── strong/                 # Strong entry, concordance, entities, and dictionary
│   │   ├── src/
│   │   │   ├── features/               # Feature modules
│   │   │   │   ├── bible/              # Bible reading and navigation
│   │   │   │   ├── resources/          # Published resource access
│   │   │   │   ├── studies/            # Study editor
│   │   │   │   ├── plans/              # Reading plans
│   │   │   │   ├── search/             # Bible and global search
│   │   │   │   ├── lexique/            # Strong lexicon list and details
│   │   │   │   ├── nave/               # Nave's Bible
│   │   │   │   ├── dictionnary/        # Bible dictionary
│   │   │   │   ├── commentaries/       # Commentaries
│   │   │   │   ├── timeline/           # Biblical timeline
│   │   │   │   ├── audio/              # Audio playback
│   │   │   │   ├── bookmarks/          # Bookmarks
│   │   │   │   ├── settings/           # Settings
│   │   │   │   └── ...
│   │   │   ├── common/                 # Shared UI components
│   │   │   ├── redux/                  # Redux store and slices
│   │   │   ├── state/                  # Jotai atoms
│   │   │   ├── helpers/                # Utilities and hooks
│   │   │   ├── navigation/             # Navigation compatibility and types
│   │   │   ├── themes/                 # Themes and colors
│   │   │   └── assets/                 # Static resources
│   │   ├── i18n/                       # Translations
│   │   └── firebase/                   # Firebase configs per environment
│   ├── web/                            # Web application
│   ├── api/                            # API and Firebase functions
│   └── lexicon-editor/                 # Editorial tools and publications
├── packages/
│   ├── resource-service/               # Publication, API, and offline copies
│   ├── resource-domain/                # Shared contracts and invariants
│   ├── resource-catalog/               # Generated resource catalog
│   └── bible-reference-parser/         # Bible reference parsing
├── docs/                               # Documentation and system ADRs
├── scripts/                            # Cross-workspace checks and tooling
├── CONTEXT-MAP.md                      # Monorepo context map
├── package.json                        # Root scripts and workspaces
└── yarn.lock                           # Single lockfile
```

Downloadable resources use a versioned mobile catalog. Canonical Bibles, their Strong indexes,
interlinear indexes, and lexicon modules are independent offline copies that are verified and
activated atomically.

For more technical details, see the [documentation index](./docs/index.md),
[mobile architecture guide](./docs/architecture.md), [context map](./CONTEXT-MAP.md),
and [mobile domain context](./apps/mobile/CONTEXT.md).

---

## Technologies

### Mobile Application

| Category | Technologies |
|----------|--------------|
| Framework | React Native 0.81, Expo SDK 54 |
| Language | TypeScript 5.9 |
| State | Redux Toolkit, Jotai, Redux Persist |
| Styling | Emotion |
| Navigation | Expo Router, React Navigation |
| Database | SQLite (expo-sqlite), Firestore |
| Auth | Firebase Auth (email, Google, Apple) |
| Audio | react-native-track-player |
| Notifications | Notifee |
| Animations | Reanimated, Moti, Lottie |

### Monorepo and Services

| Category | Technologies |
|----------|--------------|
| Workspace | Yarn 4, `apps/*` and `packages/*` workspaces |
| Web | Next.js, React, TypeScript |
| Application API | Firebase Functions, Firestore |
| Bible resources | PostgreSQL, pgvector, Cloudflare Workers, and R2 |
| Shared contracts | TypeScript `resource-domain` and `resource-catalog` packages |
| CI | GitHub Actions, PostgreSQL tests, and EAS previews |

---

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).

You are free to:
- Use the code for your personal projects
- Modify the source code
- Distribute your modifications

Provided that you:
- Keep the source code open
- Credit the original project
- Use the same GPL v3 license

---

## Support

- **Website**: [bible-strong.app](https://bible-strong.app)
- **Report a bug**: [GitHub Issues](https://github.com/smontlouis/bible-strong/issues)
- **Questions**: Open a Discussion on GitHub

---

## Acknowledgments

- The open-source community for the many libraries used
- Contributors who improve the application
- [Bible Project](https://bibleproject.com/) for educational resources
- All Bible societies for translations

---

<p align="center">
  <strong>Made with love for the Christian community</strong>
  <br/><br/>
  <a href="https://github.com/smontlouis/bible-strong/stargazers">Star this project if you appreciate it!</a>
  <br/><br/>
  Created by <a href="https://github.com/smontlouis">smontlouis</a>
</p>
