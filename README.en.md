<p align="center">
  <a href="./README.md">🇫🇷 Version française</a>
</p>

<h1 align="center">
  <img width="120" height="120" src="https://raw.githubusercontent.com/smontlouis/bible-strong/master/assets/images/icon.png"><br>
  <a href="https://bible-strong.app"><span>Bible Strong</span></a><br>
</h1>

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

- **Interlinear Bible**: display Hebrew/Greek text with word-by-word translation
- **Strong's numbers**: each word is linked to its Strong's number for in-depth study
- **Complete definitions**: etymology, meanings, uses in the Bible
- **Search by number**: find all verses using a specific word
- **Complete lexicon**: browse all Hebrew and Greek words

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
- **Offline mode**: works without internet connection

## Screenshots

*Available on the [App Store](https://apps.apple.com/fr/app/bible-strong/id1454738221) and [Play Store](https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong)*

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Yarn](https://yarnpkg.com/) v4 (managed via Corepack)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
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

   The `.env.*` files are required for the app to work.
   You will need your own Firebase keys for local development.

5. **Create a development build**

   This application requires a custom development client (not Expo Go).

   ```bash
   # For Android
   yarn build:android:dev

   # For iOS (macOS only)
   yarn build:ios:dev

   # For iOS simulator
   yarn build:ios:dev-sim
   ```

6. **Start the development server**
   ```bash
   yarn start
   ```

7. **Run on a device**
   ```bash
   # Android
   yarn android

   # iOS
   yarn ios
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn start` | Start the Expo server |
| `yarn android` | Run on Android |
| `yarn ios` | Run on iOS |
| `yarn lint` | Check code with ESLint |
| `yarn lint:fix` | Automatically fix lint errors |
| `yarn typecheck` | Check TypeScript types |
| `yarn test` | Run Jest tests |
| `yarn format` | Format code with Prettier |
| `yarn clean` | Clean and reinstall dependencies |
| `yarn i18n` | Extract translation strings |

### Production Builds

```bash
# Android
yarn build:android:staging    # Internal test build (APK)
yarn build:android:prod       # Production build (AAB)
yarn build:android:prod:apk   # Production build (APK)

# iOS
yarn build:ios:staging        # Internal test build
yarn build:ios:prod           # Production build
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
- **Styling**: use Emotion (styled components)
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

Translation files are in `i18n/locales/`:
- `fr/translation.json` - French (main language)
- `en/translation.json` - English

To add a new language:
1. Create a new folder in `i18n/locales/`
2. Copy `fr/translation.json` as a base
3. Translate the values (not the keys)
4. Open a PR

---

## Project Architecture

```
bible-strong/
├── src/
│   ├── features/           # Feature modules
│   │   ├── bible/          # Bible reading and navigation
│   │   ├── studies/        # Study editor
│   │   ├── plans/          # Reading plans
│   │   ├── search/         # Search (Algolia + Lunr)
│   │   ├── lexique/        # Strong's concordance
│   │   ├── nave/           # Nave's Bible
│   │   ├── dictionnary/    # Bible dictionary
│   │   ├── commentaries/   # Commentaries
│   │   ├── timeline/       # Biblical timeline
│   │   ├── audio/          # Audio playback
│   │   ├── bookmarks/      # Bookmarks
│   │   ├── settings/       # Settings
│   │   └── ...
│   ├── common/             # Shared UI components
│   ├── redux/              # Redux store and slices
│   ├── state/              # Jotai atoms
│   ├── helpers/            # Utilities and hooks
│   ├── navigation/         # React Navigation
│   ├── themes/             # Themes and colors
│   └── assets/             # Static resources
├── i18n/                   # Translations
├── firebase/               # Firebase configs per env
└── ...
```

For more technical details, see [CLAUDE.md](./CLAUDE.md).

---

## Technologies

| Category | Technologies |
|----------|--------------|
| Framework | React Native 0.81, Expo SDK 54 |
| Language | TypeScript 5.9 |
| State | Redux Toolkit, Jotai, Redux Persist |
| Styling | Emotion |
| Navigation | React Navigation 6 |
| Database | SQLite (expo-sqlite), Firestore |
| Auth | Firebase Auth (email, Google, Apple) |
| Audio | react-native-track-player |
| Notifications | Notifee |
| Animations | Reanimated, Moti, Lottie |

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
