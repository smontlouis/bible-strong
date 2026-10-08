<p align="center">
  <a href="./README.en.md">🇬🇧 English version</a>
</p>

<h1 align="center">
  <img width="120" height="120" src="./apps/expo/assets/images/icon.png" alt="Bible Strong"><br>
  <a href="https://bible-strong.app"><span>Bible Strong</span></a><br>
</h1>

<p align="center">
  <strong>Découvrir la Bible sous un nouveau jour</strong><br>
  <em>Une application d'étude biblique complète avec concordance Strong</em>
</p>

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://img.shields.io/badge/App_Store-disponible-blue?logo=apple&logoColor=white" alt="App Store" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://img.shields.io/badge/Google_Play-disponible-green?logo=google-play&logoColor=white" alt="Google Play" />
  </a>
  <a href="https://web.bible-strong.app">
    <img src="https://img.shields.io/badge/Web-disponible-8A2BE2?logo=googlechrome&logoColor=white" alt="Web" />
  </a>
  <a href="https://github.com/smontlouis/bible-strong/releases">
    <img src="https://img.shields.io/github/v/tag/smontlouis/bible-strong?label=version" alt="Version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/licence-GPL_v3-lightgrey" alt="Licence GPL v3" />
  </a>
</p>

<p align="center">
  <a href="https://play.google.com/apps/testing/com.smontlouis.biblestrong">Bêta Android</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://testflight.apple.com/join/Wh1Wz8Zb">Bêta iOS</a>
</p>

---

## À propos

**Bible Strong** est une application gratuite et open source pour l'étude approfondie de la Bible, disponible sur iOS, Android et le Web. Conçue d'abord pour la communauté francophone, elle permet d'explorer les textes bibliques dans leurs langues originales (hébreu et grec) grâce à la concordance Strong.

Que vous soyez étudiant en théologie, pasteur ou simplement curieux d'approfondir votre compréhension des Écritures, Bible Strong donne accès à des ressources habituellement réservées aux spécialistes, dans une interface moderne.

Ce dépôt contient tout le produit : l'application, le site public, les services qui publient et servent les ressources bibliques, et les outils qui les fabriquent.

## Utiliser Bible Strong

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Télécharger dans l'App Store" height="50" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Disponible sur Google Play" height="50" />
  </a>
</p>

- **Dans le navigateur** : [web.bible-strong.app](https://web.bible-strong.app)
- **Site public** : [bible-strong.app](https://bible-strong.app)

## Fonctionnalités

- **Lecture** : plus de 40 traductions en français, anglais, hébreu et grec ; onglets pour garder plusieurs passages ouverts ; mode parallèle pour comparer les versions ; 8 thèmes et réglages typographiques.
- **Concordance Strong** : étude de chaque mot dans sa langue originale, avec occurrences, translittération et morphologie. Les index Strong s'installent indépendamment du texte biblique, pour de nombreuses versions (LSG, Darby, KJV, NASB, BSB…).
- **Langues originales** : Bible hébreu-grec et index interlinéaires français et anglais (gloses, translittération, morphologie).
- **Outils d'étude** : surlignages, notes, signets, tags, liens entre versets, études rédigées avec un éditeur riche, historique.
- **Ressources** : Bible Nave (index thématique), dictionnaires bibliques, références croisées, commentaires, chronologie biblique interactive.
- **Plans de lecture** : plans annuels et thématiques, méditations, suivi de progression, contenus associés au Bible Project.
- **Audio** : Bible audio avec lecture en arrière-plan, réglage de la vitesse et synthèse vocale.
- **Compte et hors ligne** : synchronisation entre appareils (connexion par e-mail, Google ou Apple) et bibliothèque hors ligne dont vous choisissez le contenu sur mobile.

---

## Le monorepo

Le dépôt est un workspace Yarn 4 unique. Les applications vivent sous `apps/`, les services et bibliothèques partagés sous `packages/`.

### Applications

| Workspace | Package | Rôle | Stack |
|-----------|---------|------|-------|
| [`apps/expo`](./apps/expo/README.md) | `@bible-strong/expo` | L'application d'étude, pour iOS, Android et le Web depuis une seule base de code | Expo, React Native, Expo Router |
| [`apps/site`](./apps/site/README.md) | `@bible-strong/site` | Site public et pages de ressources indexables | TanStack Start, Tailwind CSS |
| [`apps/world`](./apps/world/README.md) | `@bible-strong/world` | Monde illustré explorable qui présente les familles de ressources, avec multijoueur et mini-jeux | Phaser, React, Cloudflare Durable Objects |
| [`apps/api`](./apps/api/CONTEXT.md) | `@bible-strong/api`, `@bible-strong/api-functions` | Opérations serveur liées aux comptes et au traitement de contenu | Firebase Functions, Firestore |
| [`apps/resource-studio`](./apps/resource-studio/README.md) | `@bible-strong/resource-studio` | Atelier éditorial : acquisition, transformation, validation et empaquetage des ressources | Vite, React, scripts Node |

### Packages

| Workspace | Package | Rôle |
|-----------|---------|------|
| [`packages/resource-service`](./packages/resource-service/README.md) | `@bible-strong/resource-service` | Valide, publie et sert les ressources bibliques versionnées (PostgreSQL, Cloudflare Workers et R2) |
| [`packages/resource-domain`](./packages/resource-domain/CONTEXT.md) | `@bible-strong/resource-domain` | Schémas, identités et invariants partagés des ressources |
| [`packages/resource-catalog`](./packages/resource-catalog/CONTEXT.md) | `@bible-strong/resource-catalog` | Catalogue généré des artefacts publiés |
| [`packages/bible-reference-parser`](./packages/bible-reference-parser/README.md) | `@bible-strong/bible-reference-parser` | Analyse des références bibliques en français et en anglais |
| [`packages/ai-contract`](./packages/ai-contract/README.md) | `@bible-strong/ai-contract` | Contrat public de l'API de l'assistant d'étude (le service est hébergé séparément) |

### Comment les pièces s'assemblent

- **Resource Studio** fabrique des lots de publication immuables ; le **Resource service** les valide, les active et les sert.
- L'**application Expo** lit les ressources en ligne via l'API du Resource service et, sur mobile, télécharge des copies hors ligne. Le **site** rend ses pages publiques côté serveur à partir de la même API.
- `resource-domain` et `resource-catalog` portent les contrats que le service, l'application et le site partagent.
- L'**API applicative** (Firebase) sert l'application et le site pour ce qui touche aux comptes.

La [carte des contextes](./CONTEXT-MAP.md) décrit ces relations en détail, et chaque workspace possède son propre `CONTEXT.md`.

---

## Démarrer

### Prérequis

- [Node.js](https://nodejs.org/) 22 (version utilisée en CI ; 20 au minimum)
- [Yarn](https://yarnpkg.com/) 4, fourni par Corepack

Chaque application ajoute ses propres prérequis (Xcode et Android Studio pour l'app native, par exemple) : voir son README.

### Installation

```bash
git clone https://github.com/smontlouis/bible-strong.git
cd bible-strong
corepack enable
yarn install
```

L'installation se fait toujours depuis la racine. Il n'y a qu'un seul `yarn.lock`, les dépendances entre workspaces utilisent `workspace:*` et les patches Yarn restent sous `.yarn/patches`.

### Lancer un produit

| Commande | Ce qu'elle démarre |
|----------|--------------------|
| `yarn dev:expo` | Serveur de développement Expo (client de développement requis, pas Expo Go) |
| `yarn dev:expo:ios` / `yarn dev:expo:android` | Application native sur simulateur, émulateur ou appareil |
| `yarn dev:expo:web` | Application Expo dans le navigateur |
| `yarn dev:site` | Site public |
| `yarn dev:world` | World et son Worker multijoueur local |
| `yarn dev:api` | Fonctions Firebase en local |
| `yarn dev:studio` | Resource Studio |
| `yarn dev:resources` | Resource service |

Pour toute autre commande d'un workspace : `yarn workspace <package> <script>`. La configuration de l'application native (variables d'environnement, builds de développement) est décrite dans le [README de `apps/expo`](./apps/expo/README.md).

### Vérifier

| Commande | Portée |
|----------|--------|
| `yarn typecheck` | Types de tous les workspaces |
| `yarn lint` | ESLint sur les workspaces qui le configurent |
| `yarn test` | Suites de tests du monorepo |
| `yarn build` | Fonctions de l'API, site et World |
| `yarn format:check` | Formatage de l'application Expo |

Les commandes de fabrication et de publication des ressources portent le préfixe `resources:` (`yarn resources:<domaine>:<action>`).

### Documentation

- [Index de la documentation](./docs/index.md)
- [Guide de développement](./docs/dev-guide.md) : installation, environnements, patches Yarn, runtime web
- [Architecture](./docs/architecture.md) et [arborescence commentée](./docs/source-tree.md)
- [Carte des contextes](./CONTEXT-MAP.md) et [décisions d'architecture (ADR)](./docs/adr/README.md)
- [Matrice de validation](./docs/agents/validation.md) : quoi vérifier selon ce que vous modifiez

---

## Contribuer

Les contributions sont les bienvenues : Bible Strong est un projet open source et communautaire.

- **Signaler un bug** : vérifiez qu'il n'existe pas déjà dans les [issues](https://github.com/smontlouis/bible-strong/issues), puis décrivez les étapes pour le reproduire, le comportement attendu et observé, votre appareil, la version du système et celle de l'application.
- **Proposer une fonctionnalité** : ouvrez une [issue](https://github.com/smontlouis/bible-strong/issues) pour en discuter avant de commencer le développement.
- **Traduire** : les fichiers de traduction de l'application sont décrits dans le [README de `apps/expo`](./apps/expo/README.md#translations).

### Soumettre du code

1. Forkez le dépôt et créez une branche (`feature/ma-fonctionnalite`, `fix/correction-bug`).
2. Faites vos modifications en suivant les conventions du workspace concerné (voir son README et son `AGENTS.md`).
3. Validez au minimum les workspaces touchés :
   ```bash
   yarn typecheck
   yarn lint
   yarn test
   ```
4. Commitez au format [Conventional Commits](https://www.conventionalcommits.org/), avec le workspace en portée si possible :
   ```bash
   git commit -m "feat(expo): ajoute une nouvelle fonctionnalité"
   git commit -m "fix(site): corrige la navigation"
   ```
5. Ouvrez une pull request vers `master` avec une description claire des changements.

---

## Licence

Ce projet est sous licence [GNU General Public License v3.0](./LICENSE).

Vous êtes libre d'utiliser, de modifier et de distribuer le code, à condition de garder le code source ouvert, de créditer le projet original et de conserver la même licence.

## Support

- **Site web** : [bible-strong.app](https://bible-strong.app)
- **Signaler un bug** : [GitHub Issues](https://github.com/smontlouis/bible-strong/issues)
- **Questions** : ouvrez une discussion sur GitHub

## Remerciements

- La communauté open source pour les nombreuses bibliothèques utilisées
- Les contributeurs qui améliorent l'application
- [Bible Project](https://bibleproject.com/) pour ses ressources éducatives
- Les sociétés bibliques pour les traductions

---

<p align="center">
  <strong>Fait avec ❤️ pour la communauté chrétienne francophone</strong>
  <br/><br/>
  <a href="https://github.com/smontlouis/bible-strong/stargazers">⭐ Mettez une étoile au projet si vous l'appréciez !</a>
  <br/><br/>
  Créé par <a href="https://github.com/smontlouis">smontlouis</a>
</p>
