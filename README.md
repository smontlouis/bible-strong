<h1 align="center">
  <img width="120" height="120" src="https://raw.githubusercontent.com/smontlouis/bible-strong/master/assets/images/icon.png"><br>
  <a href="https://bible-strong.app"><span>Bible Strong</span></a><br>
</h1>

<p align="center">
  <strong>Decouvrir la Bible sous un nouveau jour</strong><br>
  <em>Une application d'etude biblique complete avec concordance Strong</em>
</p>

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://img.shields.io/badge/App_Store-disponible-blue?logo=apple&logoColor=white" alt="App Store" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://img.shields.io/badge/Google_Play-disponible-green?logo=google-play&logoColor=white" alt="Google Play" />
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

## A propos

**Bible Strong** est une application mobile gratuite et open-source pour l'etude approfondie de la Bible. Concue principalement pour la communaute francophone, elle offre des outils puissants pour explorer les textes bibliques dans leurs langues originales (hebreu et grec) grace a la concordance Strong.

Que vous soyez etudiant en theologie, pasteur, ou simplement curieux d'approfondir votre comprehension des Ecritures, Bible Strong vous donne acces a des ressources habituellement reservees aux specialistes, le tout dans une interface moderne et intuitive.

## Telecharger l'application

<p align="center">
  <a href="https://apps.apple.com/fr/app/bible-strong/id1454738221">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="50" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong">
    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="50" />
  </a>
</p>

## Fonctionnalites principales

### Lecture de la Bible

- **40+ traductions** disponibles en francais, anglais, hebreu et grec
  - Francais : LSG 1910, Segond 21, NEG79, NBS, Semeur, Darby, Martin, Chouraqui...
  - Anglais : KJV, ESV, NIV, NKJV, NLT, NASB...
  - Langues originales : BHS (hebreu), Septante, Textus Receptus (grec)
- **Systeme d'onglets** pour naviguer entre plusieurs passages simultanement
- **Mode parallele** pour comparer differentes versions cote a cote
- **8 themes visuels** : clair, sepia, nature, coucher de soleil, sombre, noir, mauve, nuit
- **Personnalisation** : taille de police, famille de police, interligne

### Concordance Strong

La concordance Strong permet d'etudier chaque mot de la Bible dans sa langue originale :

- **Bible interlineaire** : affichez le texte hebreu/grec avec la traduction mot a mot
- **Numeros Strong** : chaque mot est lie a son numero Strong pour une etude approfondie
- **Definitions completes** : etymologie, significations, usages dans la Bible
- **Recherche par numero** : trouvez tous les versets utilisant un mot specifique
- **Lexique complet** : parcourez l'ensemble des mots hebreux et grecs

### Outils d'etude

- **Surlignage colore** : marquez les versets importants avec des couleurs personnalisables
- **Notes personnelles** : ajoutez vos reflexions a chaque verset
- **Signets** : retrouvez rapidement vos passages favoris
- **Tags** : organisez vos versets par themes personnalises
- **Liens entre versets** : creez des connexions entre passages relies
- **Etudes** : redigez des etudes completes avec editeur riche
- **Historique** : retrouvez les derniers versets consultes

### References et ressources

- **Bible Nave** : index thematique de la Bible avec des milliers d'entrees
- **Dictionnaire biblique** : definitions des termes, lieux et personnages
- **Tresor des Ecritures** : references croisees pour chaque verset
- **Commentaires bibliques** : eclairages sur les passages

### Plans de lecture

- **Plans annuels** : lisez la Bible en un an avec differentes methodes
- **Plans thematiques** : explorez des sujets specifiques
- **Meditations guidees** : contenus avec textes, videos et reflexions
- **Suivi de progression** : visualisez votre avancement
- **Integration Bible Project** : plans associes aux videos du Bible Project

### Audio

- **Bible audio** : ecoutez la Bible en plusieurs versions
- **Lecture en arriere-plan** : continuez l'ecoute meme l'ecran eteint
- **Controle de vitesse** : ajustez la vitesse de lecture
- **Synthese vocale** : ecoutez n'importe quelle version avec le TTS

### Chronologie biblique

- **Timeline interactive** : visualisez l'histoire de la Bible
- **Evenements majeurs** : de la creation a l'eglise primitive
- **Navigation intuitive** : deplacez-vous dans le temps facilement

### Synchronisation et sauvegarde

- **Compte utilisateur** : connectez-vous avec Google ou Apple
- **Synchronisation cloud** : retrouvez vos donnees sur tous vos appareils
- **Sauvegarde automatique** : ne perdez jamais vos notes et surlignages
- **Mode hors-ligne** : fonctionne sans connexion internet

## Captures d'ecran

*Disponibles sur l'[App Store](https://apps.apple.com/fr/app/bible-strong/id1454738221) et le [Play Store](https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong)*

---

## Installation pour le developpement

### Prerequis

- [Node.js](https://nodejs.org/) (v18 ou superieur)
- [Yarn](https://yarnpkg.com/) v4 (gere via Corepack)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [EAS CLI](https://docs.expo.dev/eas/) pour les builds
- Pour iOS : macOS avec Xcode 15+
- Pour Android : Android Studio avec un emulateur ou un appareil physique

### Etapes d'installation

1. **Cloner le repository**
   ```bash
   git clone https://github.com/smontlouis/bible-strong.git
   cd bible-strong
   ```

2. **Activer Corepack pour Yarn 4**
   ```bash
   corepack enable
   ```

3. **Installer les dependances**
   ```bash
   yarn install
   ```

4. **Configurer les variables d'environnement**

   Les fichiers `.env.*` sont necessaires pour le fonctionnement de l'app.
   Vous aurez besoin de vos propres cles Firebase pour le developpement local.

5. **Creer un build de developpement**

   Cette application necessite un client de developpement personnalise (pas Expo Go).

   ```bash
   # Pour Android
   yarn build:android:dev

   # Pour iOS (macOS uniquement)
   yarn build:ios:dev

   # Pour le simulateur iOS
   yarn build:ios:dev-sim
   ```

6. **Lancer le serveur de developpement**
   ```bash
   yarn start
   ```

7. **Lancer sur un appareil**
   ```bash
   # Android
   yarn android

   # iOS
   yarn ios
   ```

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| `yarn start` | Demarre le serveur Expo |
| `yarn android` | Lance sur Android |
| `yarn ios` | Lance sur iOS |
| `yarn lint` | Verifie le code avec ESLint |
| `yarn lint:fix` | Corrige automatiquement les erreurs de lint |
| `yarn typecheck` | Verifie les types TypeScript |
| `yarn test` | Lance les tests Jest |
| `yarn format` | Formate le code avec Prettier |
| `yarn clean` | Nettoie et reinstalle les dependances |
| `yarn i18n` | Extrait les chaines de traduction |

### Builds de production

```bash
# Android
yarn build:android:staging    # Build de test interne (APK)
yarn build:android:prod       # Build de production (AAB)
yarn build:android:prod:apk   # Build de production (APK)

# iOS
yarn build:ios:staging        # Build de test interne
yarn build:ios:prod           # Build de production
```

---

## Contribuer

Les contributions sont les bienvenues ! Bible Strong est un projet open-source et communautaire.

### Comment contribuer

#### Signaler un bug

1. Verifiez que le bug n'a pas deja ete signale dans les [Issues](https://github.com/smontlouis/bible-strong/issues)
2. Creez une nouvelle issue en decrivant :
   - Les etapes pour reproduire le bug
   - Le comportement attendu vs le comportement observe
   - Votre appareil, version de l'OS et version de l'app
   - Des captures d'ecran si possible

#### Proposer une fonctionnalite

1. Ouvrez une [Issue](https://github.com/smontlouis/bible-strong/issues) pour discuter de votre idee
2. Decrivez le besoin et la solution envisagee
3. Attendez la validation avant de commencer le developpement

#### Soumettre du code

1. **Fork** le repository
2. Creez une branche pour votre modification :
   ```bash
   git checkout -b feature/ma-fonctionnalite
   # ou
   git checkout -b fix/correction-bug
   ```
3. Faites vos modifications en respectant les conventions du projet
4. Assurez-vous que le code passe les verifications :
   ```bash
   yarn lint
   yarn typecheck
   ```
5. Commitez avec un message clair suivant les [Conventional Commits](https://www.conventionalcommits.org/) :
   ```bash
   git commit -m "feat: ajoute une nouvelle fonctionnalite"
   git commit -m "fix: corrige le bug de navigation"
   git commit -m "docs: met a jour la documentation"
   ```
6. Poussez votre branche :
   ```bash
   git push origin feature/ma-fonctionnalite
   ```
7. Ouvrez une **Pull Request** avec une description claire des changements

### Conventions de code

- **TypeScript** : typage strict active, evitez les `any`
- **ESLint** : configuration Expo + Prettier
- **Styling** : utilisation d'Emotion (styled components)
- **Etat** : Redux pour les donnees persistantes, Jotai pour l'UI locale
- **Commits** : format Conventional Commits
  - `feat:` nouvelle fonctionnalite
  - `fix:` correction de bug
  - `docs:` documentation
  - `refactor:` refactorisation sans changement fonctionnel
  - `style:` formatage, pas de changement de code
  - `test:` ajout ou modification de tests
  - `chore:` maintenance, dependances

### Traductions

Vous souhaitez aider a traduire l'application ?

Les fichiers de traduction sont dans `i18n/locales/` :
- `fr/translation.json` - Francais (langue principale)
- `en/translation.json` - Anglais

Pour ajouter une nouvelle langue :
1. Creez un nouveau dossier dans `i18n/locales/`
2. Copiez `fr/translation.json` comme base
3. Traduisez les valeurs (pas les cles)
4. Ouvrez une PR

---

## Architecture du projet

```
bible-strong/
├── src/
│   ├── features/           # Modules fonctionnels
│   │   ├── bible/          # Lecture et navigation biblique
│   │   ├── studies/        # Editeur d'etudes
│   │   ├── plans/          # Plans de lecture
│   │   ├── search/         # Recherche (Algolia + Lunr)
│   │   ├── lexique/        # Concordance Strong
│   │   ├── nave/           # Bible Nave
│   │   ├── dictionnary/    # Dictionnaire biblique
│   │   ├── commentaries/   # Commentaires
│   │   ├── timeline/       # Chronologie biblique
│   │   ├── audio/          # Lecture audio
│   │   ├── bookmarks/      # Signets
│   │   ├── settings/       # Parametres
│   │   └── ...
│   ├── common/             # Composants UI partages
│   ├── redux/              # Store Redux et slices
│   ├── state/              # Atoms Jotai
│   ├── helpers/            # Utilitaires et hooks
│   ├── navigation/         # React Navigation
│   ├── themes/             # Themes et couleurs
│   └── assets/             # Ressources statiques
├── i18n/                   # Traductions
├── firebase/               # Configs Firebase par env
└── ...
```

Pour plus de details techniques, consultez [CLAUDE.md](./CLAUDE.md).

---

## Technologies

| Categorie | Technologies |
|-----------|--------------|
| Framework | React Native 0.81, Expo SDK 54 |
| Langage | TypeScript 5.9 |
| Etat | Redux Toolkit, Jotai, Redux Persist |
| Styling | Emotion |
| Navigation | React Navigation 6 |
| Base de donnees | SQLite (expo-sqlite), Firestore |
| Auth | Firebase Auth (email, Google, Apple) |
| Audio | react-native-track-player |
| Notifications | Notifee |
| Animations | Reanimated, Moti, Lottie |

---

## Licence

Ce projet est sous licence [GNU General Public License v3.0](./LICENSE).

Vous etes libre de :
- Utiliser le code pour vos projets personnels
- Modifier le code source
- Distribuer vos modifications

A condition de :
- Garder le code source ouvert
- Créditer le projet original
- Utiliser la meme licence GPL v3

---

## Support

- **Site web** : [bible-strong.app](https://bible-strong.app)
- **Signaler un bug** : [GitHub Issues](https://github.com/smontlouis/bible-strong/issues)
- **Questions** : Ouvrez une Discussion sur GitHub

---

## Remerciements

- La communaute open-source pour les nombreuses bibliotheques utilisees
- Les contributeurs qui ameliorent l'application
- [Bible Project](https://bibleproject.com/) pour les ressources educatives
- Toutes les societes bibliques pour les traductions

---

<p align="center">
  <strong>Fait avec ❤️ pour la communaute chretienne francophone</strong>
  <br/><br/>
  <a href="https://github.com/smontlouis/bible-strong/stargazers">⭐ Star ce projet si vous l'appreciez !</a>
</p>
