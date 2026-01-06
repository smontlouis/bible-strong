# Arbre Source Annoté - Bible Strong

> Généré automatiquement le 2026-01-06

## Structure du projet

```
bible-strong-app/
├── App.tsx                    # Point d'entrée, chargement des fonts et splash
├── InitApp.tsx                # Configuration des providers (Theme, Redux, Navigation)
├── app.config.ts              # Configuration Expo dynamique
├── package.json               # Dépendances et scripts npm
├── tsconfig.json              # Configuration TypeScript avec path aliases
├── babel.config.js            # Configuration Babel avec module-resolver
├── eas.json                   # Configuration EAS Build (dev, staging, prod)
│
├── src/                       # Code source principal
│   ├── assets/                # Ressources statiques
│   │   ├── bible_versions/    # Définitions des livres bibliques
│   │   │   ├── books-desc.ts  # Liste des 66 livres avec chapitres
│   │   │   └── books-desc-2.ts
│   │   ├── fonts/             # Polices personnalisées
│   │   ├── images/            # Images et icônes
│   │   │   └── tab-icons/     # Icônes de la barre de navigation
│   │   ├── plans/             # Assets des plans de lecture
│   │   ├── sounds/            # Fichiers audio
│   │   └── timeline/          # Assets de la chronologie
│   │
│   ├── common/                # Composants UI réutilisables (80+)
│   │   ├── ui/                # Primitives UI de base
│   │   │   ├── Box.tsx        # Container avec props de style
│   │   │   ├── Stack.tsx      # HStack, VStack pour layouts
│   │   │   ├── Button.tsx     # Bouton stylisé
│   │   │   ├── Text.tsx       # Texte avec theming
│   │   │   ├── Progress.tsx   # Indicateur de progression
│   │   │   ├── Switch.tsx     # Toggle switch
│   │   │   ├── Slider.tsx     # Curseur
│   │   │   ├── Accordion.tsx  # Section dépliable
│   │   │   └── ...
│   │   ├── icons/             # Composants d'icônes SVG
│   │   ├── __tests__/         # Tests unitaires des composants
│   │   ├── Modal.tsx          # Modal générique
│   │   ├── Header.tsx         # En-tête de navigation
│   │   ├── Loading.tsx        # Indicateur de chargement
│   │   ├── Empty.tsx          # État vide
│   │   ├── ErrorBoundary.tsx  # Gestion des erreurs React
│   │   ├── TagList.tsx        # Liste de tags
│   │   ├── TagsModal.tsx      # Modal de sélection de tags
│   │   ├── ColorPicker.tsx    # Sélecteur de couleur
│   │   ├── LoginModal.tsx     # Modal de connexion
│   │   ├── SearchInput.tsx    # Champ de recherche
│   │   ├── InitHooks.tsx      # Hooks d'initialisation globaux
│   │   └── ...
│   │
│   ├── features/              # Modules fonctionnels (feature-based)
│   │   │
│   │   ├── app-switcher/      # Système de gestion des onglets
│   │   │   ├── AppSwitcherScreen/
│   │   │   │   └── AppSwitcherScreen.tsx  # Écran principal avec onglets
│   │   │   ├── BottomTabBar/              # Barre de navigation inférieure
│   │   │   │   ├── BottomTabBar.tsx
│   │   │   │   └── Buttons/               # Boutons de la barre
│   │   │   ├── TabScreen/                 # Conteneur d'onglet
│   │   │   │   ├── TabScreen.tsx
│   │   │   │   └── NewTab/                # Écran nouvel onglet
│   │   │   ├── TabPreviewCarousel/        # Carrousel de preview
│   │   │   ├── context/                   # Contexte React pour tabs
│   │   │   │   ├── TabContext.tsx
│   │   │   │   └── type.ts
│   │   │   └── utils/                     # Utilitaires
│   │   │       └── constants.ts
│   │   │
│   │   ├── bible/             # Feature principale - Lecture de la Bible
│   │   │   ├── BibleScreen.tsx            # Point d'entrée
│   │   │   ├── BibleTabScreen.tsx         # Wrapper avec logique de tab
│   │   │   ├── BibleViewer.tsx            # Orchestrateur principal
│   │   │   ├── BibleHeader.tsx            # En-tête avec navigation
│   │   │   ├── BibleDOM/                  # Rendu WebView du texte
│   │   │   │   ├── BibleDOMWrapper.tsx    # Container WebView
│   │   │   │   ├── VerseContext.ts        # Contexte des versets
│   │   │   │   ├── InterlinearVerse.tsx   # Verset interlinéaire
│   │   │   │   └── ...
│   │   │   ├── BookSelectorBottomSheet/   # Sélecteur de livre
│   │   │   │   ├── index.ts
│   │   │   │   ├── atom.ts
│   │   │   │   └── constants.ts
│   │   │   ├── VersionSelectorBottomSheet/ # Sélecteur de version
│   │   │   ├── footer/                    # Barre inférieure
│   │   │   │   ├── AudioBar.tsx           # Contrôles audio
│   │   │   │   ├── AudioButton.tsx
│   │   │   │   └── BasicFooter.tsx
│   │   │   ├── resources/                 # Ressources liées
│   │   │   ├── BookSelector.tsx           # Sélection de livre
│   │   │   ├── ChapterSelector.tsx        # Sélection de chapitre
│   │   │   ├── VerseSelector.tsx          # Sélection de verset
│   │   │   ├── StrongScreen.tsx           # Détail lexique Strong
│   │   │   ├── ConcordanceScreen.tsx      # Concordance
│   │   │   ├── CompareVersesScreen.tsx    # Comparaison versions
│   │   │   ├── HistoryScreen.tsx          # Historique navigation
│   │   │   ├── PericopeScreen.tsx         # Sections thématiques
│   │   │   └── ...
│   │   │
│   │   ├── studies/           # Études bibliques avec éditeur
│   │   │   ├── StudiesScreen.tsx          # Liste des études
│   │   │   ├── StudiesTabScreen.tsx       # Tab wrapper
│   │   │   ├── AllStudiesTabScreen.tsx    # Toutes les études
│   │   │   ├── EditStudyScreen.tsx        # Éditeur d'étude
│   │   │   ├── StudiesDOM/                # Éditeur Quill.js
│   │   │   │   ├── index.tsx              # Point d'entrée DOM
│   │   │   │   └── StudiesDomWrapper.tsx
│   │   │   └── hooks/                     # Hooks personnalisés
│   │   │
│   │   ├── plans/             # Plans de lecture
│   │   │   ├── PlanScreen/                # Détail d'un plan
│   │   │   │   ├── PlanScreen.tsx
│   │   │   │   └── SectionHeader.tsx
│   │   │   ├── PlanSliceScreen/           # Lecture d'une tranche
│   │   │   │   ├── PlanSliceScreen.tsx
│   │   │   │   ├── ImageSlice.tsx
│   │   │   │   └── ReadButton.tsx
│   │   │   ├── MyPlanListScreen/          # Mes plans
│   │   │   │   └── MyPlanListScreen.tsx
│   │   │   ├── Explore/                   # Découverte de plans
│   │   │   │   ├── ExploreScreen.tsx
│   │   │   │   └── ExplorePlanItem.tsx
│   │   │   └── PlanSelectScreen.tsx       # Sélection de plan
│   │   │
│   │   ├── search/            # Recherche biblique
│   │   │   ├── SearchScreen.tsx           # Écran principal
│   │   │   ├── SearchTabScreen.tsx        # Tab wrapper
│   │   │   ├── OnlineSearchScreen.tsx     # Recherche Algolia
│   │   │   ├── LocalSearchScreen.tsx      # Recherche Lunr.js
│   │   │   ├── Filters.tsx                # Filtres de recherche
│   │   │   ├── RefinementList.tsx         # Liste de raffinement
│   │   │   └── bibleLSG.ts                # Index Bible LSG
│   │   │
│   │   ├── lexique/           # Lexique Strong
│   │   │   ├── LexiqueScreen.tsx          # Liste des entrées
│   │   │   ├── LexiqueListScreen.tsx      # Liste alphabétique
│   │   │   ├── StrongTabScreen.tsx        # Tab Strong
│   │   │   ├── StrongDetailScreen.tsx     # Détail d'un mot
│   │   │   └── useUtilities.tsx           # Utilitaires
│   │   │
│   │   ├── dictionnary/       # Dictionnaire biblique
│   │   │   ├── DictionaryScreen.tsx       # Écran principal
│   │   │   ├── DictionaryTabScreen.tsx    # Tab wrapper
│   │   │   ├── DictionaryListScreen.tsx   # Liste alphabétique
│   │   │   ├── DictionaryDetailScreen.tsx # Détail d'un mot
│   │   │   └── DictionaryDetailTabScreen.tsx
│   │   │
│   │   ├── nave/              # Bible thématique Nave
│   │   │   ├── NaveScreen.tsx             # Écran principal
│   │   │   ├── NaveTabScreen.tsx          # Tab wrapper
│   │   │   ├── NaveListScreen.tsx         # Liste des thèmes
│   │   │   ├── NaveDetailScreen.tsx       # Détail d'un thème
│   │   │   ├── NaveDetailTabScreen.tsx
│   │   │   ├── NaveModalForVerse.tsx      # Modal depuis verset
│   │   │   └── NaveWarningScreen.tsx      # Avertissement
│   │   │
│   │   ├── commentaries/      # Commentaires bibliques
│   │   │   ├── CommentariesScreen.tsx     # Liste des commentaires
│   │   │   ├── CommentariesTabScreen.tsx  # Tab wrapper
│   │   │   ├── CommentariesCard.tsx       # Carte de commentaire
│   │   │   └── types.ts                   # Types TypeScript
│   │   │
│   │   ├── timeline/          # Chronologie biblique
│   │   │   ├── TimelineScreen.tsx         # Visualisation
│   │   │   ├── TimelineHomeScreen.tsx     # Écran d'accueil
│   │   │   ├── TimelineItem.tsx           # Item de timeline
│   │   │   ├── EventDetailsTab.tsx        # Détails événement
│   │   │   ├── SearchResults.tsx          # Résultats recherche
│   │   │   ├── events.ts                  # Données événements
│   │   │   ├── constants.ts               # Constantes
│   │   │   └── types.ts                   # Types
│   │   │
│   │   ├── audio/             # Lecture audio
│   │   │   └── README.md                  # Documentation feature
│   │   │
│   │   ├── notes/             # Notes personnelles
│   │   │   ├── NotesTabScreen.tsx         # Tab notes
│   │   │   ├── AllNotesTabScreen.tsx      # Toutes les notes
│   │   │   └── NoteDetailTabScreen.tsx    # Détail d'une note
│   │   │
│   │   ├── bookmarks/         # Favoris
│   │   │   └── BookmarksScreen.tsx        # Liste des favoris
│   │   │
│   │   ├── home/              # Écran d'accueil
│   │   │   ├── HomeScreen.tsx             # Écran principal
│   │   │   ├── widget.tsx                 # Widget plan du jour
│   │   │   ├── RandomButton.tsx           # Verset aléatoire
│   │   │   └── getDayOfTheYear.ts         # Utilitaire date
│   │   │
│   │   ├── settings/          # Paramètres
│   │   │   ├── MoreScreen.tsx             # Menu paramètres
│   │   │   ├── LoginScreen.tsx            # Connexion
│   │   │   ├── RegisterScreen.tsx         # Inscription
│   │   │   ├── ForgotPasswordScreen.tsx   # Mot de passe oublié
│   │   │   ├── ThemeScreen.tsx            # Choix du thème
│   │   │   ├── DownloadsScreen.tsx        # Téléchargements
│   │   │   ├── BackupScreen.tsx           # Sauvegarde/restauration
│   │   │   ├── AutomaticBackupsScreen.tsx # Backups auto
│   │   │   ├── HighlightsScreen.tsx       # Gestion surlignages
│   │   │   ├── CustomHighlightColorsScreen.tsx # Couleurs perso
│   │   │   ├── TagsScreen.tsx             # Gestion des tags
│   │   │   ├── TagScreen.tsx              # Détail d'un tag
│   │   │   ├── BibleDefaultsScreen.tsx    # Paramètres Bible
│   │   │   ├── BibleShareOptionsScreen.tsx # Options partage
│   │   │   ├── ResourceLanguageScreen.tsx # Langue ressources
│   │   │   ├── FAQScreen.tsx              # FAQ
│   │   │   └── SupportScreen.tsx          # Support
│   │   │
│   │   ├── profile/           # Profil utilisateur
│   │   │   ├── ProfileScreen.tsx          # Écran profil
│   │   │   └── components/                # Composants profil
│   │   │
│   │   ├── onboarding/        # Accueil première utilisation
│   │   │   └── slides.ts                  # Contenu des slides
│   │   │
│   │   └── tips/              # Conseils et astuces
│   │       └── atom.ts                    # État des tips
│   │
│   ├── helpers/               # Utilitaires et hooks
│   │   ├── bibleVersions.ts   # Définitions versions Bible
│   │   ├── databases.ts       # Configuration bases SQLite
│   │   ├── databaseTypes.ts   # Types pour bases de données
│   │   ├── databaseMigration.ts # Migrations de données
│   │   ├── firebase.ts        # Configuration Firebase
│   │   ├── FireAuth.ts        # Authentification Firebase
│   │   ├── storage.ts         # MMKV storage
│   │   ├── atomWithAsyncStorage.ts # Atom Jotai persistant
│   │   ├── TokenManager.ts    # Gestion tokens auth
│   │   ├── AutoBackupManager.ts # Backups automatiques
│   │   ├── firestoreSubcollections.ts # Helpers Firestore
│   │   ├── firestoreMigration.ts # Migration Firestore
│   │   ├── getSQLTransaction.ts # Transactions SQLite
│   │   ├── requireBiblePath.ts  # Chemins Bible
│   │   ├── getBiblePericope.ts  # Péricopes
│   │   ├── highlightColors.ts   # Couleurs de surlignage
│   │   ├── useAsync.ts          # Hook async
│   │   ├── useDisclosure.ts     # Hook modal
│   │   ├── useFuzzy.ts          # Hook recherche fuzzy
│   │   ├── useLanguage.ts       # Hook langue
│   │   ├── useRemoteConfig.ts   # Hook Firebase Remote Config
│   │   ├── deep-obj/            # Utilitaires diff objets
│   │   ├── notifications/       # Notifications push
│   │   ├── trackPlayer/         # Audio track player
│   │   ├── react-native-htmlview/ # Rendu HTML
│   │   └── react-native-youtube-iframe/ # Lecteur YouTube
│   │
│   ├── navigation/            # Configuration navigation
│   │   ├── MainStackNavigator.tsx # Stack principal (45 routes)
│   │   ├── AppNavigator.tsx       # Navigateur racine
│   │   └── type.ts                # Types des paramètres
│   │
│   ├── redux/                 # État global Redux
│   │   ├── store.ts           # Configuration du store
│   │   ├── firestoreMiddleware.ts # Sync Firestore automatique
│   │   ├── logMiddleware.ts   # Logging et crash reporting
│   │   ├── migrations.ts      # Migrations de l'état
│   │   ├── modules/           # Reducers par domaine
│   │   │   ├── reducer.ts     # Root reducer
│   │   │   ├── plan.ts        # État des plans
│   │   │   ├── user.ts        # État utilisateur principal
│   │   │   ├── user/          # Sous-reducers utilisateur
│   │   │   │   ├── bookmarks.ts   # Favoris
│   │   │   │   ├── highlights.ts  # Surlignages
│   │   │   │   ├── notes.ts       # Notes
│   │   │   │   ├── links.ts       # Liens externes
│   │   │   │   ├── studies.ts     # Études
│   │   │   │   ├── tags.ts        # Tags
│   │   │   │   ├── settings.ts    # Paramètres
│   │   │   │   ├── customColors.ts # Couleurs perso
│   │   │   │   └── versionUpdate.ts
│   │   │   └── __tests__/     # Tests des reducers
│   │   └── selectors/         # Sélecteurs Redux
│   │       ├── plan.ts
│   │       ├── tags.ts
│   │       └── bookmarks.ts
│   │
│   ├── state/                 # État Jotai
│   │   ├── tabs.ts            # État des onglets (970+ lignes)
│   │   ├── migration.ts       # Migrations d'état
│   │   └── resourcesLanguage.ts # Langue des ressources
│   │
│   ├── themes/                # Thèmes visuels
│   │   ├── index.ts           # Export des thèmes
│   │   ├── default.ts         # Thème par défaut
│   │   ├── colors.ts          # Couleurs principales
│   │   ├── darkColors.ts      # Mode sombre
│   │   ├── blackColors.ts     # Contraste élevé
│   │   ├── sepiaColors.ts     # Thème sépia
│   │   ├── mauveColors.ts     # Thème mauve
│   │   ├── natureColors.ts    # Thème nature
│   │   ├── nightColors.ts     # Thème nuit
│   │   └── sunsetColors.ts    # Thème coucher de soleil
│   │
│   └── types/                 # Types TypeScript globaux
│       └── *.d.ts             # Déclarations de types
│
├── i18n/                      # Internationalisation
│   ├── index.ts               # Configuration i18next
│   └── locales/
│       ├── fr/                # Traductions françaises
│       │   └── translation.json
│       └── en/                # Traductions anglaises
│           └── translation.json
│
├── firebase/                  # Configuration Firebase par env
│   ├── dev/                   # Environnement développement
│   │   ├── google-services.json
│   │   └── GoogleService-Info.plist
│   ├── staging/               # Environnement staging
│   │   └── ...
│   └── prod/                  # Environnement production
│       └── ...
│
├── plugins/                   # Plugins Expo personnalisés
│
├── migrations/                # Scripts de migration
│   └── multilang-support.md   # Documentation migration multilingue
│
├── docs/                      # Documentation générée
│   ├── project-scan-report.json # État du scan
│   └── source-tree.md         # Ce fichier
│
├── .env.development           # Variables env développement
├── .env.staging               # Variables env staging
├── .env.production            # Variables env production
│
├── CLAUDE.md                  # Guide pour assistants IA
├── README.md                  # Documentation principale (FR)
└── README.en.md               # Documentation principale (EN)
```

## Statistiques du code

| Catégorie | Fichiers | Description |
|-----------|----------|-------------|
| **Écrans** | 90 | Composants Screen |
| **Composants UI** | 80+ | Composants réutilisables |
| **Helpers** | 50+ | Utilitaires et hooks |
| **Redux modules** | 12 | Reducers et actions |
| **Jotai atoms** | 20+ | États atomiques |
| **Thèmes** | 8 | Palettes de couleurs |
| **Traductions** | 2 | Langues (FR, EN) |

## Points d'entrée clés

| Fichier | Responsabilité |
|---------|----------------|
| `App.tsx` | Bootstrap, fonts, splash screen |
| `InitApp.tsx` | Providers (Theme, Redux, Navigation) |
| `src/navigation/MainStackNavigator.tsx` | Définition des 45 routes |
| `src/redux/store.ts` | Configuration Redux avec MMKV persist |
| `src/state/tabs.ts` | Gestion multi-onglets avec Jotai |
| `src/redux/firestoreMiddleware.ts` | Synchronisation Firestore |
