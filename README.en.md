<p align="center">
  <a href="./README.md">🇫🇷 Version française</a>
</p>

<h1 align="center">
  <img width="120" height="120" src="./apps/expo/assets/images/icon.png" alt="Bible Strong"><br>
  <a href="https://bible-strong.app"><span>Bible Strong</span></a><br>
</h1>

<p align="center">
  <strong>Discover the Bible in a new light</strong><br>
  <em>A complete Bible study app with Strong's concordance</em>
</p>

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://img.shields.io/badge/App_Store-available-blue?logo=apple&logoColor=white" alt="App Store" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://img.shields.io/badge/Google_Play-available-green?logo=google-play&logoColor=white" alt="Google Play" />
  </a>
  <a href="https://web.bible-strong.app">
    <img src="https://img.shields.io/badge/Web-available-8A2BE2?logo=googlechrome&logoColor=white" alt="Web" />
  </a>
  <a href="https://github.com/smontlouis/bible-strong/releases">
    <img src="https://img.shields.io/github/v/tag/smontlouis/bible-strong?label=version" alt="Version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-GPL_v3-lightgrey" alt="GPL v3 license" />
  </a>
</p>

<p align="center">
  <a href="https://play.google.com/apps/testing/com.smontlouis.biblestrong">Android beta</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://testflight.apple.com/join/Wh1Wz8Zb">iOS beta</a>
</p>

---

## About

**Bible Strong** is a free, open-source app for in-depth Bible study, available on iOS, Android, and the Web. Built first for the French-speaking community, it lets you explore the biblical texts in their original languages (Hebrew and Greek) through Strong's concordance.

Whether you are a theology student, a pastor, or simply curious to deepen your understanding of Scripture, Bible Strong gives you access to resources usually reserved for specialists, in a modern interface.

This repository holds the whole product: the app, the public site, the services that publish and serve Bible resources, and the tools that produce them.

## Use Bible Strong

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="50" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="50" />
  </a>
</p>

- **In the browser**: [web.bible-strong.app](https://web.bible-strong.app)
- **Public site**: [bible-strong.app](https://bible-strong.app)

## Features

- **Reading**: more than 40 translations in French, English, Hebrew, and Greek; tabs to keep several passages open; parallel mode to compare versions; 8 themes and typography settings.
- **Strong's concordance**: study every word in its original language, with occurrences, transliteration, and morphology. Strong indexes install independently from the Bible text, for many versions (LSG, Darby, KJV, NASB, BSB…).
- **Original languages**: Hebrew-Greek Bible and French and English interlinear indexes (glosses, transliteration, morphology).
- **Study tools**: highlights, notes, bookmarks, tags, links between verses, studies written in a rich editor, history.
- **Resources**: Nave's Topical Bible, Bible dictionaries, cross-references, commentaries, interactive biblical timeline.
- **Reading plans**: yearly and thematic plans, meditations, progress tracking, content paired with the Bible Project.
- **Audio**: audio Bible with background playback, speed control, and text-to-speech.
- **Account and offline**: sync across devices (sign in with email, Google, or Apple) and an offline library whose content you choose on mobile.

---

## The monorepo

The repository is a single Yarn 4 workspace. Applications live under `apps/`, shared services and libraries under `packages/`.

### Applications

| Workspace | Package | Role | Stack |
|-----------|---------|------|-------|
| [`apps/expo`](./apps/expo/README.md) | `@bible-strong/expo` | The study app, for iOS, Android, and the Web from one codebase | Expo, React Native, Expo Router |
| [`apps/site`](./apps/site/README.md) | `@bible-strong/site` | Public site and indexable resource pages | TanStack Start, Tailwind CSS |
| [`apps/world`](./apps/world/README.md) | `@bible-strong/world` | Explorable illustrated world that introduces the resource families, with multiplayer and mini-games | Phaser, React, Cloudflare Durable Objects |
| [`apps/api`](./apps/api/CONTEXT.md) | `@bible-strong/api`, `@bible-strong/api-functions` | Server operations for accounts and content processing | Firebase Functions, Firestore |
| [`apps/resource-studio`](./apps/resource-studio/README.md) | `@bible-strong/resource-studio` | Editorial studio: resource acquisition, transformation, validation, and packaging | Vite, React, Node scripts |

### Packages

| Workspace | Package | Role |
|-----------|---------|------|
| [`packages/resource-service`](./packages/resource-service/README.md) | `@bible-strong/resource-service` | Validates, publishes, and serves versioned Bible resources (PostgreSQL, Cloudflare Workers and R2) |
| [`packages/resource-domain`](./packages/resource-domain/CONTEXT.md) | `@bible-strong/resource-domain` | Shared resource schemas, identities, and invariants |
| [`packages/resource-catalog`](./packages/resource-catalog/CONTEXT.md) | `@bible-strong/resource-catalog` | Generated catalog of published artifacts |
| [`packages/bible-reference-parser`](./packages/bible-reference-parser/README.md) | `@bible-strong/bible-reference-parser` | French and English Bible reference parsing |
| [`packages/ai-contract`](./packages/ai-contract/README.md) | `@bible-strong/ai-contract` | Public API contract of the study assistant (the service is hosted separately) |

### How the pieces fit together

- **Resource Studio** produces immutable publication bundles; the **Resource service** validates, activates, and serves them.
- The **Expo app** reads resources online through the Resource service API and, on mobile, downloads offline copies. The **site** renders its public pages on the server from the same API.
- `resource-domain` and `resource-catalog` carry the contracts shared by the service, the app, and the site.
- The **Application API** (Firebase) serves the app and the site for account-related operations.

The [context map](./CONTEXT-MAP.md) describes these relationships in detail, and each workspace has its own `CONTEXT.md`.

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 (the version used in CI; 20 at minimum)
- [Yarn](https://yarnpkg.com/) 4, provided by Corepack

Each application adds its own prerequisites (Xcode and Android Studio for the native app, for example): see its README.

### Installation

```bash
git clone https://github.com/smontlouis/bible-strong.git
cd bible-strong
corepack enable
yarn install
```

Always install from the repository root. There is a single `yarn.lock`, dependencies between workspaces use `workspace:*`, and Yarn patches stay under `.yarn/patches`.

### Run a product

| Command | What it starts |
|---------|----------------|
| `yarn dev:expo` | Expo development server (requires a development client, not Expo Go) |
| `yarn dev:expo:ios` / `yarn dev:expo:android` | Native app on a simulator, emulator, or device |
| `yarn dev:expo:web` | Expo app in the browser |
| `yarn dev:site` | Public site |
| `yarn dev:world` | World and its local multiplayer Worker |
| `yarn dev:api` | Firebase functions locally |
| `yarn dev:studio` | Resource Studio |
| `yarn dev:resources` | Resource service |

For any other workspace command: `yarn workspace <package> <script>`. Native app setup (environment variables, development builds) is described in the [`apps/expo` README](./apps/expo/README.md).

### Validate

| Command | Scope |
|---------|-------|
| `yarn typecheck` | Types across all workspaces |
| `yarn lint` | ESLint on the workspaces that configure it |
| `yarn test` | Monorepo test suites |
| `yarn build` | API functions, site, and World |
| `yarn format:check` | Expo app formatting |

Resource production and publication commands use the `resources:` prefix (`yarn resources:<domain>:<action>`).

### Documentation

- [Documentation index](./docs/index.md)
- [Development guide](./docs/dev-guide.md): setup, environments, Yarn patches, web runtime
- [Architecture](./docs/architecture.md) and [annotated source tree](./docs/source-tree.md)
- [Context map](./CONTEXT-MAP.md) and [architecture decision records (ADRs)](./docs/adr/README.md)
- [Validation matrix](./docs/agents/validation.md): what to check depending on what you change

---

## Contributing

Contributions are welcome: Bible Strong is an open-source, community project.

- **Report a bug**: check that it is not already in the [issues](https://github.com/smontlouis/bible-strong/issues), then describe the steps to reproduce it, the expected and observed behavior, your device, OS version, and app version.
- **Suggest a feature**: open an [issue](https://github.com/smontlouis/bible-strong/issues) to discuss it before starting development.
- **Translate**: the app's translation files are described in the [`apps/expo` README](./apps/expo/README.md#translations).

### Submitting code

1. Fork the repository and create a branch (`feature/my-feature`, `fix/bug-fix`).
2. Make your changes following the conventions of the workspace you touch (see its README and `AGENTS.md`).
3. Validate at least the workspaces you touched:
   ```bash
   yarn typecheck
   yarn lint
   yarn test
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/), with the workspace as scope when possible:
   ```bash
   git commit -m "feat(expo): add a new feature"
   git commit -m "fix(site): fix navigation"
   ```
5. Open a pull request against `master` with a clear description of the changes.

---

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).

You are free to use, modify, and distribute the code, provided you keep the source open, credit the original project, and keep the same license.

## Support

- **Website**: [bible-strong.app](https://bible-strong.app)
- **Report a bug**: [GitHub Issues](https://github.com/smontlouis/bible-strong/issues)
- **Questions**: open a discussion on GitHub

## Acknowledgments

- The open-source community for the many libraries used
- The contributors who improve the app
- [Bible Project](https://bibleproject.com/) for its educational resources
- The Bible societies for the translations

---

<p align="center">
  <strong>Made with ❤️ for the French-speaking Christian community</strong>
  <br/><br/>
  <a href="https://github.com/smontlouis/bible-strong/stargazers">⭐ Star this project if you like it!</a>
  <br/><br/>
  Created by <a href="https://github.com/smontlouis">smontlouis</a>
</p>
