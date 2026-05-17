# App Flows

Ce document décrit les principaux parcours utilisateur de Bible Strong: surfaces, écrans, utilité, états visibles et transitions. Il complète `CONTEXT.md`, `docs/architecture.md` et `docs/data-models.md`.

## Assets De Cartographie

Les captures exploitables pour la cartographie visuelle sont versionnées sous `docs/assets/app-flows/screenshots/` au format WebP optimisé. Le manifest `docs/assets/app-flows/data/screenshots.json` liste chaque capture avec son identifiant, son titre et son chemin d'image.

La source maintenue à la main est `docs/assets/app-flows/data/curated-flows.json`. Elle définit les surfaces produit, les vrais flows utilisateur et les transitions explicites entre captures.

La source générée du graphe est `docs/assets/app-flows/data/app-flows.json`. Elle combine:

- l'inventaire automatique des captures depuis `screenshots.json`;
- les flows curatés depuis `curated-flows.json`;
- les edges d'ordre de capture, marqués `relation: "capture-order"`;
- les transitions utilisateur, marquées `relation: "user-action"`.

Les captures obsolètes où une WebView/DOM affichait seulement un écran blanc, offline ou erreur transitoire sont documentées dans `capture-notes.md` quand une capture fonctionnelle les remplace.

Le viewer principal React Flow est dans `docs/assets/app-flows/viewer/` et se build vers `docs/assets/app-flows/dist/`. Il fournit zoom, pan, drag de noeuds, MiniMap, filtres par flow curaté, surface, inventaire automatique, recherche, risque, thumbnails et panneau détail.

Commandes:

```bash
yarn docs:flows:data
yarn docs:flows:build
yarn docs:flows:dev
```

Les notes complètes de capture Argent sont conservées dans `docs/assets/app-flows/capture-notes.md`: elles documentent le contexte du simulateur, les limites observées, les mutations de données effectuées pendant l'exploration et les cibles restantes.

`.scratch/argent-feature-map/` reste une zone de travail locale pour les captures Argent brutes et n'est pas une source durable, car elle est ignorée par Git.

## Modèle De Cartographie

La cartographie sépare volontairement quatre notions qui étaient faciles à mélanger:

| Notion | Définition | Exemple |
|---|---|---|
| Capture | État visuel observé dans l'app. | `screen-003`, lecteur biblique avec sélection. |
| Surface | Zone produit stable. | Bible, Workspace, Ressources locales, Données personnelles. |
| Flow | Objectif utilisateur avec début, actions et résultat. | Lire un chapitre, comparer des versions, annoter une sélection. |
| Transition | Action explicite entre deux captures. | `Annoter`, `changer version`, `partage natif`. |

Les anciens regroupements automatiques restent utiles pour retrouver rapidement une capture, mais ils ne doivent pas être traités comme des workflows produit. Un flow fiable doit être ajouté dans `curated-flows.json`.

Surfaces curatées:

| Surface | Rôle |
|---|---|
| Workspace | Onglets, groupes, drawers et nouvel onglet. |
| Bible | Lecture, navigation, sélection, comparaison, annotations et ressources contextuelles. |
| Données personnelles | Notes, highlights, liens, favoris, tags et annotations de mots. |
| Ressources locales | Téléchargements et ressources bibliques installées. |
| Recherche | Recherche biblique et filtres. |
| Études | Liste, édition riche, insertion de versets et actions d'étude. |
| Plans | Exploration, suivi, lecture de tranche et partage. |
| Chronologie | Sections, événements et module chronologique. |
| Accueil | Découverte, reprise, verset du jour et handoffs. |
| Compte et réglages | Profil, préférences, sauvegardes, aide et actions sensibles. |
| Audio | Audio distant et TTS. |

## Vue D'ensemble

Bible Strong est organisée autour d'un espace de travail à onglets plutôt qu'une navigation linéaire classique. L'utilisateur lit la Bible, ouvre des ressources d'étude, compare des versions, crée des annotations, lance des plans et revient ensuite à ces surfaces via l'app switcher.

Surfaces racines:

| Surface | Route | Utilité |
|---|---|---|
| App switcher | `/` | Espace central: groupes d'onglets, onglets ouverts, barre de navigation basse, drawers Accueil et Plus. |
| Accueil | `/home` ou drawer gauche | Widgets de découverte, apprentissage, étude, méditation et contribution. |
| Plus | `/more` ou drawer droit | Compte, ressources, paramètres, aide, communauté et actions de maintenance. |
| Bible | `/bible-view` ou onglet `bible` | Lecture principale, sélection, annotation, notes, liens, tags, audio et ressources contextuelles. |
| Recherche | `/search`, `/local-search` ou onglet `search` | Recherche biblique et accès rapide à des résultats Strong, dictionnaire et Nave. |

Le démarrage passe par `app/_layout.tsx`: chargement i18n, migrations de stockage, thème, Redux persist, état des bases de données, AppSwitcherProvider, bottom sheets, modales globales, puis route `/`.

## États Globaux

États de démarrage:

| État | Déclencheur | UI / comportement |
|---|---|---|
| Splash natif | Application lancée | Splash maintenu jusqu'à la fin de l'initialisation i18n. |
| Loading app | i18n/persist non prêts | `ActivityIndicator` plein écran. |
| PersistGate loading | Redux persist en cours | `ActivityIndicator` centré. |
| App prête | Layout monté | Splash masqué, Sentry initialisé, route `/` affichée. |
| Error boundary | Exception React | Écran d'erreur global avec signalement Sentry. |

Modales globales différées après les premières interactions:

| Modale | Utilité |
|---|---|
| Changelog | Présente les nouveautés si nécessaire. |
| Onboarding | Installation initiale des ressources essentielles. |
| UnifiedTagsModal | Création/association de tags depuis plusieurs surfaces. |
| ColorPickerModal / ColorChangeModal | Choix et modification de couleurs d'annotation. |
| TagDetailModal | Détail rapide d'un tag. |
| FeatureOnboardingModal | Découverte guidée de nouvelles fonctionnalités. |
| AppRatingModal | Demande d'avis selon les règles de déclenchement. |

## Flow D'onboarding

Route principale: modale globale `src/features/onboarding/OnBoarding.tsx`.

But: permettre à un premier utilisateur d'installer au moins les ressources de base avant d'utiliser l'app.

Étapes:

1. Slides de bienvenue: présentation des fonctionnalités clés.
2. Sélection des ressources: choix des versions bibliques et bases nécessaires.
3. Téléchargement: progression globale et individuelle, erreurs, retry et fin d'installation.

États:

| État | Description |
|---|---|
| Non requis | Les ressources par défaut sont déjà présentes. |
| Modal ouvert | Onboarding plein écran, non dismissible pour les ressources essentielles. |
| Sélection vide ou invalide | L'utilisateur doit choisir une Bible compatible avec la langue courante. |
| Téléchargement en cours | Progression par ressource et progression globale. |
| Erreur de téléchargement | Message d'erreur, possibilité de relancer. |
| Terminé | L'app recharge ou ferme l'onboarding selon l'orchestrateur. |

## Workspace Et Onglets

Code principal: `src/features/app-switcher/` et `src/state/tabs.ts`.

L'app switcher est la vraie maison de l'application. Il contient:

| Élément | Utilité |
|---|---|
| `TabGroupPager` | Naviguer entre groupes d'onglets. |
| `CachedTabScreens` | Maintenir les écrans d'onglets montés pour préserver leur état. |
| `SharedBibleDOM` | Mutualiser le rendu DOM/WebView de la Bible entre onglets Bible. |
| `TabPreviewCarousel` | Afficher les aperçus d'onglets. |
| `BottomTabBar` | Accès à Accueil, Bible, Recherche, ajout d'onglet, switcher et menu Plus. |

Types d'onglets persistés:

| Type | Utilité | Données clés |
|---|---|---|
| `bible` | Lecture d'un passage | Version, livre, chapitre, verset, versions parallèles, sélection, mode lecture. |
| `search` | Recherche biblique | Texte recherché. |
| `compare` | Comparaison de versions | Versets sélectionnés. |
| `strong` | Détail lexical Strong | Référence Strong ou contexte de livre. |
| `nave` | Thème Nave | Nom et clé du thème. |
| `dictionary` | Entrée dictionnaire | Mot sélectionné. |
| `study` | Liste ou édition d'étude | `studyId` optionnel. |
| `notes` | Liste ou détail de note | `noteId` optionnel. |
| `commentary` | Commentaires pour un verset | Clé de verset. |
| `new` | Sélecteur de nouvel onglet | Aucun état métier. |

États du workspace:

| État | Description |
|---|---|
| Groupe par défaut | Créé avec une Bible ouverte sur Genèse 1:1. |
| Groupe actif | Groupe affiché dans le pager. |
| Onglet actif | Écran rendu au centre et contrôlé par la bottom bar. |
| Ajout d'onglet | Ouvre le flow New Tab pour choisir Bible, recherche ou ressources. |
| Drawer Accueil ouvert | Translation vers le panneau gauche. |
| Drawer Plus ouvert | Translation vers le panneau droit. |
| Back Android | Ferme d'abord le drawer ouvert, sinon laisse la navigation gérer. |

## Accueil

Route: `/home`; composant: `src/features/home/HomeScreen.tsx`.

But: proposer des raccourcis de découverte et reprise sans interrompre l'espace d'onglets.

Sections:

| Section | Contenu | Transitions |
|---|---|---|
| Événements | Messages ou annonces applicatives. | Selon configuration. |
| Utilisateur | Widget compte/session. | Profil ou connexion. |
| Statistiques | Résumé des données utilisateur. | Profil ou collections associées. |
| Apprendre | BibleProject, timeline. | Plans BibleProject, `/timeline-home`. |
| Étudier | Strong du jour, Nave du jour, mot du jour. | Strong, Nave, dictionnaire. |
| Méditer | Plan en cours, Audibible. | Plan, lecture audio externe. |
| Aller plus loin | Don, réseaux sociaux, FAQ. | Liens externes ou `/faq`. |

États:

| État | Description |
|---|---|
| Connecté | Affiche données utilisateur et statistiques. |
| Non connecté | Widgets orientent vers connexion/profil local. |
| Apple reviewing | Masque les appels au don/contribution. |
| Fermeture | Bouton `x` en bas ferme le drawer. |

## Menu Plus Et Paramètres

Route: `/more`; composant: `src/features/settings/MoreScreen.tsx`.

But: concentrer les réglages, ressources, compte et liens d'aide.

Sections:

| Section | Entrées | États / remarques |
|---|---|---|
| Compte | Profil, déconnexion ou connexion | Connecté: profil + logout. Non connecté: login. |
| Ressources | Lexique, Dictionnaire, Nave, Plans | Ouvre les surfaces d'étude correspondantes. |
| Paramètres | Langue des ressources, thème, version par défaut, téléchargements, mise à jour OTA | Téléchargements peut afficher un indicateur de mise à jour. |
| Aide | Changelog, FAQ, mail développeur | Routes internes et mailto. |
| Communauté | Facebook, notation, partage, contribution, GitHub | Liens externes ou partage natif. |
| Légal | Confidentialité, EULA | Langue dépend de l'app. |
| Dev | Nuke app | Visible en développement seulement, destructif. |

États:

| État | Description |
|---|---|
| Vérification OTA | Spinner sur l'action de mise à jour. |
| Update disponible | Toast, téléchargement puis reload. |
| Pas d'update | Toast d'information. |
| Erreur update | Toast d'erreur. |
| Suppression compte | Bottom sheet dédiée si connecté. |

## Authentification Et Profil

Routes: `/login`, `/register`, `/forgot-password`, `/profile`.

But: permettre la sauvegarde cloud des données utilisateur et la gestion du compte.

Flows:

| Flow | Route | Description |
|---|---|---|
| Connexion | `/login` | Formulaire commun `Login`, message de bénéfice cloud, retour automatique si connecté. |
| Inscription | `/register` | Création de compte email/mot de passe et providers supportés par le composant commun. |
| Mot de passe oublié | `/forgot-password` | Envoi d'une réinitialisation par email. |
| Profil | `/profile` | En-tête utilisateur, statistiques, actions compte. Redirige vers `/login` si non connecté. |
| Déconnexion | Depuis `/more` | Confirmation puis logout. |
| Suppression compte | Depuis Plus/Profile | Confirmation dédiée, action destructive. |

États:

| État | Description |
|---|---|
| Non connecté | Données restent locales; profil redirige vers login. |
| Connecté | Données utilisateur syncables via Firestore middleware. |
| Email non vérifié | Modal ou action de vérification depuis profil selon composant. |
| Changement mot de passe | Modal dédiée depuis actions profil. |

## Lecture Bible

Routes: `/bible-view`, `/bible-select`, `/version-selector`, `/bible-verse-detail`, onglet `bible`; composants principaux: `BibleScreen`, `BibleTabScreen`, `BibleViewer`, `BibleDOM`, `BibleHeader`, `BibleFooter`.

But: décrire la surface Bible. Les workflows concrets sont séparés dans `curated-flows.json` pour éviter de mélanger lecture, réglages, téléchargement, comparaison, péricopes et annotations dans un seul parcours.

Flows curatés de la surface Bible:

| Flow | Contenu | Hors scope |
|---|---|---|
| Lire et naviguer dans la Bible | Lecteur, choix livre/chapitre/version, menu lecteur, historique. | Paramètres d'apparence, comparaison, téléchargement. |
| Régler l'apparence de lecture | Réglages rapides, bottom sheet lecteur, options de partage, thème. | Changement de passage ou données utilisateur. |
| Changer ou installer une version | Sélecteur de version, ressource absente, téléchargement BHS, retour au lecteur. | Gestion globale des téléchargements. |
| Comparer des versions | Versions parallèles, compare-verses, sélection locale des versions à comparer. | Réglages généraux du lecteur. |
| Agir sur une sélection de versets | Annoter, note, lien, favori, tag, ajout à une étude, copie et partage natif. | Consultation ultérieure des collections personnelles. |
| Gérer couleurs et annotations du lecteur | Palette, couleurs personnalisées, labels de versets, annotations cross-version, annotations de mots. | Liste globale Notes/Highlights/Tags. |
| Étudier Strong et langues originales | Numéros Strong, détail lexical, concordance, BHS. | Téléchargements génériques hors besoin Strong/BHS. |

Structure:

| Zone | Utilité |
|---|---|
| Header | Livre/chapitre/version, retour, menus, historique, favoris, paramètres, comparaison. |
| BibleDOM | Rendu du chapitre, versets, interlinéaire, tags, notes, liens, sélection et annotations. |
| Footer | Navigation chapitre, audio/TTS, retour audio, contrôles contextuels. |
| Bottom sheets | Sélecteur livre/chapitre/verset, version, paramètres, ressources, sélection. |

Écrans auxiliaires:

| Route | Utilité |
|---|---|
| `/bible-select` | Sélection Bible livre/chapitre/verset pour un onglet Bible. |
| `/version-selector` | Sélection de version principale ou parallèle. |
| `/bible-verse-detail` | Détail d'un verset, navigation vers notes/liens/commentaires et actions contextuelles. |
| `/pericope` | Navigation dans les péricopes ou sections thématiques du texte biblique. |

États de lecture:

| État | Description |
|---|---|
| Chargement | Base/version/chapitre en cours de chargement. |
| Erreur | BibleErrorView si la ressource est indisponible ou corrompue. |
| Lecture normale | Texte affiché, sélection possible. |
| Read-only | Écran consultatif sans actions de modification. |
| Focus versets | Versets passés en paramètres mis en évidence/scrollés. |
| Mode sélection depuis étude | Bible ouverte pour choisir un passage à insérer dans une étude. |
| Mode parallèle | Versions additionnelles affichées côte à côte ou verticalement. |
| Interlinéaire | Texte original avec éléments Strong et alignements. |
| Audio actif | Footer audio remplace ou enrichit la navigation. |

Navigation biblique:

| Action | Résultat |
|---|---|
| Choisir livre/chapitre/verset | Met à jour l'onglet Bible actif. |
| Changer de version | Recharge la version; peut exiger téléchargement. |
| Swipe chapitre | Passe au chapitre précédent/suivant. |
| Historique | Revient à une référence consultée. |
| Ouvrir dans nouvel onglet | Crée un onglet Bible indépendant. |
| Lien de ressource | Ouvre Strong, dictionnaire, Nave, commentaires ou Bible selon le type de lien. |

## Sélection, Annotations Et Données Personnelles

Surface principale: `SelectedVersesModal`, `AnnotationToolbar`, modales note/lien/tag.

Deux niveaux existent:

| Niveau | Donnée | Stockage |
|---|---|---|
| Verset | Highlight, note, lien, tag, favori, ajout à étude, partage | `user.bible.highlights`, `notes`, `links`, `bookmarks`, `tags`, `studies`. |
| Mot / range | Annotation libre, note d'annotation, tag, suppression | `user.bible.wordAnnotations`. |

Flow sélection de versets:

1. L'utilisateur tape ou sélectionne un ou plusieurs versets.
2. `SelectedVersesModal` s'ouvre avec les onglets Annoter, Étudier, Partager.
3. Annoter: couleur/type de highlight, note, lien, tag, favori.
4. Étudier: ajout à une étude existante ou nouvelle.
5. Partager: formatage selon options de partage, appel au partage natif.

Flow mode libre:

1. L'utilisateur active le mode annotation libre.
2. Il sélectionne un mot ou une plage dans le DOM.
3. `AnnotationToolbar` permet couleur, type, note, tag ou suppression.
4. La sélection est enregistrée dans les annotations de mots et réaffichée au rendu.

États:

| État | Description |
|---|---|
| Aucun verset sélectionné | Bottom sheet fermé, lecture normale. |
| Sélection multi-versets | Actions appliquées à une plage. |
| Couleur existante | Retaper la couleur active peut retirer le highlight. |
| Note existante | Le bouton note ouvre l'édition plutôt que création. |
| Lien enrichi | Open Graph peut alimenter titre/type de lien. |
| Tag associé | Le contenu apparaît ensuite dans Tags et détails de tag. |

## Notes, Highlights, Liens, Favoris Et Tags

Routes: `/bible-verse-notes`, `/bible-verse-links`, `/highlights`, `/bookmarks`, `/tags`, `/tag`, `/word-annotations`.

But: consulter et gérer les contenus personnels créés depuis la Bible et les ressources.

Écrans:

| Route | Utilité | États |
|---|---|---|
| `/highlights` | Liste des surlignages verset. | Liste, filtre/couleur selon écran, empty state. |
| `/word-annotations` | Liste des annotations libres. | Liste, menu par annotation, empty state. |
| `/bible-verse-notes` | Notes liées aux versets. | Liste, détail, édition via modale. |
| `/bible-verse-links` | Liens attachés à une sélection. | Liste, création/édition/suppression. |
| `/bookmarks` | Marque-pages bibliques. | Liste, suppression, navigation vers Bible. |
| `/tags` | Liste des étiquettes. | Recherche, création, édition, suppression, création de groupe depuis tag. |
| `/tag` | Détail d'une étiquette. | Contenus groupés par type, actions de navigation. |

Flow tag:

1. Création depuis `/tags` ou depuis une modale d'association.
2. Association à highlight, annotation, note, lien, étude, Strong, dictionnaire ou Nave.
3. Consultation dans `/tag`.
4. Option de créer un groupe d'onglets depuis les contenus du tag.

## Recherche

Routes: `/search`, `/local-search`, onglet `search`; composants: `SearchScreen`, `SQLiteSearchScreen`, `SearchTabScreen`.

But: rechercher des versets hors ligne et proposer des ressources liées.

Flow:

1. L'utilisateur ouvre Recherche depuis la bottom bar ou une route.
2. Il saisit une requête.
3. La recherche SQLite FTS5 retourne des versets paginés.
4. Les widgets Strong, Dictionnaire et Nave peuvent apparaître selon les résultats.
5. Un tap sur un verset ouvre la Bible à la référence.

États:

| État | Description |
|---|---|
| Requête vide | Empty state ou suggestions/références. |
| Recherche en cours | Debounce et chargement local. |
| Résultats | Liste paginée, termes mis en évidence. |
| Aucun résultat | Empty state. |
| Filtre actif | AT/NT, livre ou tri selon l'écran. |
| Base absente | Ressource à télécharger avant recherche. |

## Ressources Bibliques

Routes: `/lexique`, `/strong`, `/concordance`, `/concordance-by-book`, `/dictionnaire`, `/dictionnary-detail`, `/dictionnaire-verse-detail`, `/nave`, `/nave-detail`, `/nave-warning`, `/commentaries`.

But: approfondir un passage depuis des ressources lexicales, thématiques, dictionnaires et commentaires.

### Strong / Lexique

| Route | Utilité |
|---|---|
| `/lexique` | Liste/recherche du lexique Strong. |
| `/strong` | Détail d'un mot grec/hébreu: définition, prononciation/audio, occurrences. |
| `/concordance` | Occurrences globales d'une référence Strong. |
| `/concordance-by-book` | Occurrences filtrées par livre. |

États: base Strong absente, recherche vide, résultats, détail, audio de prononciation disponible ou non, ouverture dans nouvel onglet, tags.

### Dictionnaire

| Route | Utilité |
|---|---|
| `/dictionnaire` | Liste alphabétique et recherche dans le dictionnaire Westphal. |
| `/dictionnary-detail` | Définition HTML d'une entrée, références cliquables, tags et partage. |
| `/dictionnaire-verse-detail` | Carte de verset ouverte depuis une définition du dictionnaire. |

États: base absente, liste par lettre, recherche, détail, liens vers Bible ou autre entrée, empty state.

### Nave

| Route | Utilité |
|---|---|
| `/nave` | Liste des thèmes Nave et recherche. |
| `/nave-detail` | Détail d'un thème et références bibliques. |
| `/nave-warning` | Avertissement langue/contenu pour utilisateurs FR. |

États: avertissement FR, base absente, liste alphabétique, recherche, détail HTML, tags, partage, liens vers Bible ou autre thème.

### Commentaires

| Route | Utilité |
|---|---|
| `/commentaries` | Commentaires disponibles pour un verset donné. |

États: aucun commentaire, commentaires groupés, liens externes ou bibliques, partage.

## Comparaison Et Versions

Routes: `/bible-compare-verses`, `/toggle-compare-verses`; modales: version selector, compare selector, parallel versions popover.

But: comparer un verset ou une sélection dans plusieurs traductions et gérer les versions parallèles de lecture.

Flows:

| Flow | Description |
|---|---|
| Comparer une sélection | Depuis la modale de versets, ouvre un écran/onglet `compare` avec les versets sélectionnés. |
| Ajouter une version parallèle | Depuis le header Bible, sélection d'une version à afficher à côté de la version active. |
| Retirer une version parallèle | Popover de versions parallèles, suppression de la version secondaire. |
| Changer orientation | Basculer affichage vertical/horizontal selon support. |
| Télécharger version | Si une version n'est pas locale, renvoie vers téléchargement ou action directe selon composant. |

États: aucune version parallèle, une ou plusieurs versions, version absente, comparaison prête, lecture read-only de comparaison.

## Audio Bible

Composants principaux: `src/features/bible/footer/`.

But: écouter un chapitre via TTS ou audio distant avec contrôle depuis la Bible.

Modes:

| Mode | Description |
|---|---|
| TTS | Synthèse vocale native, voix, vitesse, pitch, répétition. |
| URL audio | Lecture distante avec TrackPlayer, vitesse, seek, répétition. |
| Compact | Footer réduit intégré à la lecture. |
| Étendu | Contrôles détaillés et navigation audio. |
| Retour audio | Footer permettant de revenir à l'audio actif depuis une autre navigation. |

États:

| État | Description |
|---|---|
| Inactif | Footer basique chapitre précédent/suivant. |
| Buffering | Icône/état de chargement audio. |
| Playing | Lecture active, verset courant synchronisé si possible. |
| Paused | Lecture suspendue. |
| Sleep timer actif | Arrêt programmé. |
| Repeat actif | Répète verset, chapitre ou livre. |
| Erreur audio | Fallback vers TTS ou message selon source. |

## Plans De Lecture

Routes: `/plans`, `/my-plan-list`, `/plan`, `/plan-slice`.

But: découvrir, suivre et terminer des plans annuels ou de méditation.

Écrans:

| Route | Utilité |
|---|---|
| `/plans` | Sélection entre exploration et plans de l'utilisateur. |
| `/my-plan-list` | Liste des plans suivis localement. |
| `/plan` | Détail d'un plan: sections, progression, menu. |
| `/plan-slice` | Lecture immersive d'une tranche de plan. |

États plan:

| État | Description |
|---|---|
| Idle | Plan non commencé. |
| Next | Prochaine lecture à faire. |
| Progress | Plan en cours. |
| Completed | Plan ou tranche terminé. |
| Reset | Progression remise à zéro depuis le menu. |
| Success | Modal de félicitations après achèvement. |

Types de tranches:

| Type | Rendu |
|---|---|
| Title | Titre/section. |
| Text | Méditation ou enseignement. |
| Verse | Passage biblique ciblé. |
| Chapter | Chapitre biblique. |
| Image | Illustration. |
| Video | Vidéo YouTube. |

Transitions: home widget vers prochaine lecture, plan vers Bible pour lecture complète, plan slice vers partage, réglages de police/thème depuis `ParamsModal`.

## Études

Routes: `/studies`, `/edit-study`, onglet `study`; composants: `StudiesScreen`, `AllStudiesTabScreen`, `EditStudyScreen`, `StudiesDOM`.

But: créer et éditer des études bibliques riches, avec insertion de versets et Strong.

Flow liste:

1. Ouvrir `/studies`.
2. Afficher toutes les études.
3. Créer une nouvelle étude ou ouvrir une étude existante.
4. Filtrer/organiser par tags selon UI disponible.

Flow édition:

1. `/edit-study` reçoit un `studyId`.
2. L'éditeur Quill DOM charge le Delta de l'étude.
3. Auto-save après modification.
4. Footer d'édition fournit formatage, listes, undo/redo, insertion de verset ou Strong.
5. Menu permet paramètres, publication, export PDF, partage et suppression.

États:

| État | Description |
|---|---|
| Nouvelle étude | Titre/contenu créés avec un nouvel id. |
| Chargement étude | Récupération du Delta et métadonnées. |
| Édition | Clavier et footer formatage actifs. |
| Sauvegarde automatique | Debounce après modification. |
| Publiée | URL partageable disponible. |
| Non publiée | Contenu local/sync privé. |
| Export PDF | Appel cloud function puis téléchargement/partage. |

## Timeline

Routes: `/timeline-home`, `/timeline`.

But: explorer les périodes et événements bibliques dans une chronologie interactive.

Écrans:

| Route | Utilité |
|---|---|
| `/timeline-home` | Liste des grandes sections chronologiques, introduction et recherche. |
| `/timeline` | Vue horizontale d'une section avec barre d'années et événements. |

États:

| État | Description |
|---|---|
| Vue sections | Cartes de périodes disponibles. |
| Section active | Timeline centrée sur une période. |
| Événement sélectionné | Modal de détail, média et références bibliques. |
| Recherche | Modal de recherche locale d'événements. |
| Détail section | Modal d'explication de la période. |
| Navigation référence | Tap sur référence ouvre Bible. |

## Téléchargements Et Ressources Locales

Route: `/downloads`; composant: `DownloadsScreen`.

But: installer, mettre à jour, retélécharger ou supprimer les Bibles et bases SQLite/JSON.

Sections selon langue:

| Section | Contenu |
|---|---|
| Bases FR/EN | Strong, dictionnaire, Nave, commentaires, ressources par langue. |
| Références croisées | Bases partagées. |
| Bibles Segond / FR / EN / autres | Versions bibliques installables. |

États:

| État | Description |
|---|---|
| Collapsed section | Les sections sont repliées par défaut. |
| Recherche active | Sections développées pour montrer les résultats. |
| Filtres actifs | Par statut téléchargé/non téléchargé et langue. |
| Installé | Item marqué disponible, action delete/redownload selon cas. |
| Non installé | Action download. |
| Mise à jour requise | Indicateur/action update depuis `needsUpdate`. |
| Version par défaut | Suppression désactivée, redownload possible. |
| Mode sélection | Sélection multi-items et barre batch. |
| Téléchargement global | `GlobalDownloadBar` affiche les opérations en file. |

Actions:

| Action | Résultat |
|---|---|
| Télécharger | Ajoute un item à la queue de téléchargement. |
| Télécharger en lot | Ajoute les items sélectionnés non installés. |
| Supprimer | Confirmation puis suppression fichier/base. |
| Supprimer en lot | Exclut la Bible par défaut, confirme puis supprime. |
| Retélécharger | Supprime puis remet en queue. |
| Mettre à jour | Supprime l'ancienne ressource et télécharge la nouvelle. |

## Préférences De Lecture Et Apparence

Routes: `/theme`, `/bible-defaults`, `/bible-share-options`, `/resource-language`.

But: configurer l'apparence, les versions par défaut et le format de partage.

Écrans:

| Route | Utilité | États |
|---|---|---|
| `/theme` | Choix thème clair/sombre/couleurs. | Thème courant, prévisualisation immédiate. |
| `/bible-defaults` | Version biblique par défaut et préférences de lecture. | Version absente/installée, sélection persistée. |
| `/bible-share-options` | Format des versets partagés. | Numéros, référence, version, options activées/désactivées. |
| `/resource-language` | Langue des ressources locales. | FR/EN par ressource, restrictions FR-only. |

Paramètres Bible en modale:

| Paramètre | Effet |
|---|---|
| Taille police | Affecte BibleDOM et lecture. |
| Interligne | Affecte confort de lecture. |
| Alignement | Gauche ou justifié. |
| Affichage texte | Inline ou bloc selon options. |
| Notes/liens/tags | Inline ou indicateurs. |
| Commentaires / red letters | Affichage conditionnel selon ressource/version. |

## Import, Export Et Sauvegardes

Routes: `/import-export`, `/backup`, `/automatic-backups`.

But: protéger ou migrer les données utilisateur hors du sync automatique.

Flows:

| Flow | Description |
|---|---|
| Export manuel | Sérialise données Bible utilisateur vers fichier JSON. |
| Import manuel | Lit un fichier, valide puis fusionne ou restaure selon écran. |
| Backup | Gestion d'une sauvegarde complète. |
| Sauvegardes automatiques | Paramètres de sauvegarde périodique. |

États à documenter lors d'une évolution:

| État | Description |
|---|---|
| Non connecté | Backup cloud limité ou indisponible selon implémentation. |
| Connecté | Données aussi synchronisables via Firestore. |
| Import invalide | Erreur de validation, aucune mutation durable. |
| Import réussi | Redux/MMKV mis à jour, sync potentielle. |
| Conflit | Fusion ou remplacement doit être explicite dans l'UI. |

Ces routes touchent des zones sensibles: stockage, sync, migrations et données utilisateur.

## Aide, Support Et Informations

Routes: `/faq`, `/support`, `/changelog`.

| Route | Utilité | États |
|---|---|---|
| `/faq` | Questions fréquentes. | Liste de questions/réponses. |
| `/support` | Dons ou aide financière. | Liens externes, masquage possible en review Apple. |
| `/changelog` | Historique des versions. | Liste des changements. |

## Inventaire Des Routes

| Route | Écran | Utilité principale |
|---|---|---|
| `/` | `AppSwitcherScreen` | Workspace à onglets. |
| `/home` | `HomeScreen` | Drawer/écran d'accueil. |
| `/more` | `MoreScreen` | Menu paramètres et ressources. |
| `/profile` | `ProfileScreen` | Profil utilisateur connecté. |
| `/login` | `LoginScreen` | Connexion. |
| `/register` | `RegisterScreen` | Création de compte. |
| `/forgot-password` | `ForgotPasswordScreen` | Réinitialisation mot de passe. |
| `/bible-select` | `BibleSelect` | Sélection livre/chapitre/verset héritée. |
| `/version-selector` | `VersionSelector` | Sélection version principale ou parallèle. |
| `/bible-view` | `BibleScreen` | Lecture Bible. |
| `/bible-verse-detail` | `BibleVerseDetailScreen` | Détail d'un verset biblique. |
| `/bible-compare-verses` | `CompareVersesScreen` | Comparaison de versets. |
| `/toggle-compare-verses` | `ToggleCompareVersesScreen` | Gestion comparaison. |
| `/bible-verse-notes` | `BibleVerseNotesScreen` | Notes de versets. |
| `/bible-verse-links` | `BibleVerseLinksScreen` | Liens de versets. |
| `/highlights` | `HighlightsScreen` | Surlignages. |
| `/word-annotations` | `WordAnnotationsScreen` | Annotations libres. |
| `/bookmarks` | `BookmarksScreen` | Favoris bibliques. |
| `/history` | `HistoryScreen` | Historique de navigation Bible. |
| `/pericope` | `PericopeScreen` | Sections/péricopes bibliques. |
| `/strong` | `StrongScreen` | Détail Strong. |
| `/lexique` | `LexiqueScreen` | Lexique Strong. |
| `/concordance` | `ConcordanceScreen` | Concordance Strong. |
| `/concordance-by-book` | `ConcordanceByBookScreen` | Concordance par livre. |
| `/dictionnaire` | `DictionaryScreen` | Dictionnaire biblique. |
| `/dictionnary-detail` | `DictionaryDetailScreen` | Détail dictionnaire. |
| `/dictionnaire-verse-detail` | `DictionnaireVerseDetailScreen` | Verset ouvert depuis le dictionnaire. |
| `/nave` | `NaveScreen` | Thèmes Nave. |
| `/nave-detail` | `NaveDetailScreen` | Détail thème Nave. |
| `/nave-warning` | `NaveWarningScreen` | Avertissement Nave. |
| `/commentaries` | `CommentariesScreen` | Commentaires bibliques. |
| `/search` | `SearchScreen` | Recherche globale. |
| `/local-search` | `SQLiteSearchScreen` | Recherche SQLite locale. |
| `/studies` | `StudiesScreen` | Liste/onglet études. |
| `/edit-study` | `EditStudyScreen` | Édition d'étude. |
| `/plans` | `PlanSelectScreen` | Sélection de plans. |
| `/my-plan-list` | `MyPlanListScreen` | Mes plans. |
| `/plan` | `PlanScreen` | Détail plan. |
| `/plan-slice` | `PlanSliceScreen` | Lecture d'une tranche. |
| `/timeline-home` | `TimelineHomeScreen` | Accueil timeline. |
| `/timeline` | `TimelineScreen` | Timeline interactive. |
| `/downloads` | `DownloadsScreen` | Gestion ressources locales. |
| `/tags` | `TagsScreen` | Liste des tags. |
| `/tag` | `TagScreen` | Détail tag. |
| `/theme` | `ThemeScreen` | Thème d'application. |
| `/bible-defaults` | `BibleDefaultsScreen` | Defaults Bible. |
| `/bible-share-options` | `BibleShareOptionsScreen` | Options de partage. |
| `/resource-language` | `ResourceLanguageScreen` | Langue des ressources. |
| `/import-export` | `ImportExportScreen` | Import/export manuel. |
| `/backup` | `BackupScreen` | Sauvegarde. |
| `/automatic-backups` | `AutomaticBackupsScreen` | Sauvegardes automatiques. |
| `/faq` | `FAQScreen` | FAQ. |
| `/support` | `SupportScreen` | Support/don. |
| `/changelog` | `ChangelogScreen` | Changelog. |

## Points À Maintenir

Quand un flow évolue, mettre à jour ce document avec:

- la route ou le type d'onglet concerné;
- l'objectif utilisateur;
- les états vides, chargement, erreur, succès et mode offline;
- les données persistées ou syncées;
- les ressources locales requises;
- les transitions entrantes/sortantes.

Zones sensibles à signaler explicitement dans tout changement de flow: auth, sync Firestore, import/export, backups, téléchargements, suppression locale, migrations, route stack et état d'onglets.
