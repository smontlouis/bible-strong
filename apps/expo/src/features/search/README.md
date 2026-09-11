# Feature Search

## Vue d'ensemble

La feature Search permet de rechercher des versets bibliques en mode hors ligne avec SQLite FTS5. Elle offre des filtres avancés, des widgets (Strong, Dictionnaire, Nave) et supporte plusieurs langues.

## Fonctionnalités principales

### Recherche SQLite FTS5

- Recherche full-text performante avec prefix matching
- Filtrage par section : Ancien Testament (AT) ou Nouveau Testament (NT)
- Filtrage par livre specifique
- Tri par pertinence ou ordre biblique
- Support multilingue (Francais avec LSG, Anglais avec KJV)

### Widgets de resultats

- **Strong** : Mots hebreux/grecs correspondants
- **Dictionnaire** : Definitions associees
- **Nave** : Themes topiques lies

### Interface utilisateur

- Barre de recherche avec debouncing
- Resultats pagines
- Mise en evidence des termes recherches
- Navigation directe vers les versets trouves

## Architecture

### Structure des composants

```
search/
├── SearchTabScreen         # Container principal
├── SQLiteSearchScreen      # Recherche FTS5
└── widgets/                # Widgets Strong, Dictionnaire, Nave
```

## Utilisation

```typescript
// Navigation vers la recherche
navigation.navigate('SearchTab')
```

## Dependances cles

- `expo-sqlite` : Base de donnees SQLite avec FTS5
- `react-i18next` : Internationalisation

## Palette web et recherche persistante

La palette de commandes affiche un aperçu de trois résultats par source. Elle réutilise
les accès `bibleSearch`, `strongLexicon`, `dictionary` et `nave`, ainsi que les convertisseurs
de résultats et la recherche Fuse des notes, études et liens de cette feature.
`searchPreview.ts` porte les requêtes bornées et le contexte transmis à Recherche ;
`useSearchPreview.ts` orchestre les requêtes indépendantes avec un délai de saisie de
350 ms et masque les résultats d'une saisie précédente. Une source indisponible ne
bloque pas les autres. Les recherches distantes utilisent les signaux d'annulation
TanStack Query ; les contenus personnels restent recherchés depuis Redux.

Les aperçus de contenus sont montés uniquement quand les suggestions sont visibles.
« Voir tous les résultats » ouvre un onglet Recherche avec le texte, la catégorie et
la version biblique de l'aperçu, sans reprendre d'anciens filtres de livre ou de canon.
`SearchTab.data.filters` conserve ensuite les filtres de cet onglet. Les onglets plus
anciens sans ce champ continuent de prendre les préférences globales au montage.

Une chip d'outil limite la palette à une seule intention : Bible, Comparaison et
Commentaire prennent une référence BCV ; Notes, Études, Lexique, Nave et Dictionnaire
activent une seule source. Les autres requêtes ne sont pas lancées. Une saisie vide
propose des contenus locaux récents ou le début du catalogue. Plans filtre les plans
locaux disponibles. Retirer la chip conserve la saisie ; Retour arrière la retire
lorsque le champ est vide. La comparaison développe toute la plage de versets, y
compris les chapitres entiers ; les commentaires s'ouvrent au début du passage.

## Langue des références bibliques

`helpers/bcvParser.ts` conserve deux instances privées, française et anglaise.
Chaque appel choisit la langue explicitement fournie ou lit la langue actuelle de
l'application ; aucune langue par défaut n'est figée au démarrage. Les contenus
éditoriaux peuvent continuer à imposer leur langue, indépendamment de l'interface.

`parseBibleReferenceInput` renvoie les correspondances, la couverture exacte de la
saisie et des segments structurés par chapitre. Recherche et la palette partagent
ces segments, y compris les limites réelles des chapitres. Les anciens accès directs
à `bcv` et la conversion intermédiaire `parseResponse` ont été supprimés. Les
références enregistrées et les données utilisateur ne nécessitent aucune migration.

### Recherche classique et recherche par sens

L'onglet Recherche (mobile et web) et les aperçus Commande K lancent deux requêtes indépendantes :

- `/v1/bibles/:version/search` (ou `/v1/bibles/search`) : texte, tolérance aux fautes et alias thématiques, sans appel d'embedding.
- `/v1/bibles/:version/semantic-search` (ou `/v1/bibles/semantic-search`) : embedding et correspondances vectorielles, ajoutées au groupe unique « Passages ».

Les deux opérations partagent les filtres et le contrat de réponse, mais ont leurs propres clés TanStack Query, erreurs et pages. Les résultats classiques sont affichés en premier, puis les résultats supplémentaires sont ajoutés sans doublons (version, livre, chapitre, verset de début). Les pages suivantes conservent les positions déjà affichées. Le compteur indique le nombre de résultats uniques chargés ; « Voir plus » reste disponible tant qu’une des sources a une page suivante. La recherche par sens dispose d'un délai client de 45 secondes, sans retarder la recherche classique. Elle n'est pas lancée hors ligne ; une panne IA ne déclenche pas une copie des résultats SQLite dans la liste. Un changement de texte, langue ou filtre invalide la requête affichée et annule le signal de l'ancienne requête.

Le Worker doit être déployé avec les nouvelles routes avant de distribuer le client. La révision du cache change pour éviter qu'une ancienne réponse hybride soit servie par la route classique. Les anciens clients peuvent toujours lire `/search`, mais n'obtiennent plus les correspondances vectorielles par cette route.

## Content discovery

The existing Passages filter covers both Bible references and full-text passage search.
Commentary, Plans and Timeline are appended to the source filters.
All sources share the same input, result sections and counted facets. Passage results expose icon actions for a Bible tab and
a comparison tab. Commentary search indexes catalog titles/authors, plans index
saved and published titles, and timeline indexes period/event names. Published
plans load through the existing plan thunk before opening a tab. Native selection
uses the shared discovery results in a search sheet; Web uses command-palette
rows. See ADR-0045 for the distinct Passage/Comparison command modes and the
new-tab launch behavior. Existing library/list tabs remain valid.
