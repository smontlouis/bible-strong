# Audit Android - Migration de BibleViewer vers Jetpack Compose

Date: 2026-05-21  
Perimetre: Android uniquement. Un audit iOS SwiftUI est traite separement.

## Diagnostic court

La migration Android vers un lecteur biblique natif est faisable, mais pas comme un simple remplacement de `BibleDOM` par les composants declaratifs de `@expo/ui/jetpack-compose`. Le rendu basique d'un chapitre, des titres de pericope, des highlights de versets, des notes/liens/tags et d'un mode parallele simple peut etre porte vers Compose. En revanche, les fonctions riches du lecteur actuel reposent fortement sur le DOM: selection mot-a-mot, calcul de rectangles de texte, surlignage multi-ligne, gestes tactiles fins, commentaires HTML et synchronisation de scroll horizontal.

Recommandation: faire une migration progressive avec un composant Android natif custom via Expo module Compose, expose a React Native par une facade TypeScript. `@expo/ui/jetpack-compose` peut servir pour un prototype ou un lecteur simple encapsule dans `Host` avec `LazyColumn`, mais il ne suffit probablement pas pour le lecteur complet de Bible Strong sans ecrire des composants Compose custom.

Le choix pragmatique est:

1. Garder `BibleViewer.tsx` comme orchestrateur JS/TS dans un premier temps.
2. Extraire un contrat de donnees stable pour un `NativeBibleReader`.
3. Implementer un MVP Android Compose sans annotation mot-a-mot.
4. Migrer ensuite les gestes, annotations et modes complexes par increments.

## Sources prises en compte

- Documentation Expo SDK 56 fournie: `@expo/ui/jetpack-compose`, bundle environ `56.0.8`, inclus dans Expo Go selon la source fournie, installation `npx expo install @expo/ui`.
- Chaque arbre Compose doit etre rendu dans `Host`.
- `LazyColumn` est disponible pour les listes scrollables.
- Les modifiers de `@expo/ui/jetpack-compose/modifiers` existent pour styliser les composants Expo UI.
- Le depot est actuellement en Expo SDK 54: `package.json` depend de `expo@54.0.29`, `react-native@0.81.5`, `expo-sqlite@16.0.10`, et ne contient pas encore `@expo/ui`.

## Etat actuel du lecteur

### Orchestration React Native

`src/features/bible/BibleViewer.tsx` est deja beaucoup plus qu'un simple wrapper de rendu:

- charge le chapitre principal via `loadBibleReadingMain`;
- hydrate en arriere-plan versions paralleles, interlineaire, commentaires et paroles de Jesus en rouge via `src/features/bible/bibleReadingChapter.ts`;
- lit les annotations, notes, liens, bookmarks, tags et relations d'etude depuis Redux via les selecteurs de `~redux/selectors/bible`;
- pilote les bottom sheets: Strong, notes, liens, tags, relations, ressources, parametres, selection de versets et annotation toolbar;
- gere les onglets bibliques, le mode read-only, les focus verses, le footer de navigation et les modales cross-version.

Ce fichier peut rester le point d'integration initial. La migration la moins risquee consiste a remplacer uniquement la surface de rendu `BibleDOMWrapper` par un adaptateur Android natif, sans deplacer tout l'etat applicatif en Kotlin.

### WebView/DOM partage

`src/features/bible/SharedBibleDOM.tsx` maintient un unique `BibleDOMWrapper` prechauffe, deplace via `react-native-teleport` vers l'onglet actif. Le but est clair: eviter le cout d'initialisation WebView et contourner les ecrans blancs Android. Il garde un host offscreen, retarget les portals et force un remount apres timeout.

`src/features/bible/BibleDOM/BibleDOMWrapper.tsx` contient le bridge actuel:

- gate `verses` jusqu'au signal `DOM_COMPONENT_MOUNTED`;
- declenche un watchdog de 5 secondes;
- compresse les settings avant bridge;
- calcule cote RN des metadonnees de versets dans `computeVerseMetadata.ts`;
- mappe les actions DOM vers navigation, Redux, Jotai, router, modales et selection.

Cette couche est le meilleur point de depart pour definir l'API d'un `NativeBibleReader`: memes donnees d'entree, memes evenements de sortie, mais sans DOM.

### Rendu DOM

`src/features/bible/BibleDOM/BibleDOMComponent.tsx` est un composant `use dom`. Il depend de:

- `goober` pour le styling CSS;
- `document`, `window`, `DOMRect`, `Range`, `querySelector`, `scrollTo`, `addEventListener`;
- CSS sticky headers, transitions, `content-visibility`, pseudo-selecteurs et filtres SVG;
- gestion manuelle du scroll vertical et horizontal.

`src/features/bible/BibleDOM/UnifiedVersesRenderer.tsx` et `src/features/bible/BibleDOM/Verse.tsx` rendent:

- versets normaux;
- versions Strong (`LSGS`, `KJVS`) avec references Strong cliquables via `verseToStrong.tsx`;
- paroles en rouge via `verseToRedWords.tsx`;
- interlineaire compact/complet via `InterlinearVerse.tsx` et `InterlinearVerseComplete.tsx`;
- modes paralleles horizontal et vertical;
- pericopes, commentaires, notes, liens, tags, bookmarks, relations d'etude, annotations cross-version.

### Annotation mot-a-mot

Le bloc le plus difficile est dans `src/features/bible/BibleDOM/AnnotationMode/**`:

- `useTouchSelection.ts` gere tap, double tap, long press, drag horizontal, swipe, auto-scroll et handles de selection;
- `useAnnotationHighlights.ts` convertit des ranges de mots en rectangles DOM avec `document.createRange()`, `getClientRects()` et fusion multi-ligne;
- `domUtils.ts` et `selectionUtils.ts` mapent une position tactile vers un mot;
- `src/features/bible/hooks/useAnnotationMode.ts` conserve l'etat natif RN et synchronise avec Redux.

En Compose, il faudra reconstruire cette geometrie avec `TextLayoutResult`, des offsets de caracteres, `getBoundingBox(offset)`, un overlay `Canvas`, et une couche de gestures Compose. C'est faisable, mais c'est un chantier specifique.

## Faisabilite avec `@expo/ui/jetpack-compose`

### Ce que `@expo/ui` peut couvrir

Pour un MVP Android, `@expo/ui/jetpack-compose` peut couvrir:

- un `Host style={{ flex: 1 }}` pour monter l'arbre Compose;
- un `LazyColumn` pour afficher les versets d'un chapitre;
- `Text`, `Row`, `Column`, `Box` et modifiers pour le layout de base;
- les evenements `onPress` simples remontes vers JS;
- un prototype sans module Kotlin custom si l'API exposee par Expo UI suffit.

Cette option permet de valider rapidement:

- performance de scroll sur un chapitre long;
- cout de serialization des props;
- rendu typographique et theming;
- integration dans `BibleViewer.tsx`;
- cohabitation avec les bottom sheets existantes.

### Limites pour un lecteur riche

Pour Bible Strong, `@expo/ui/jetpack-compose` seul est probablement trop limite:

- le lecteur a besoin de textes riches avec spans cliquables, highlights partiels, underline, couleur de texte, RTL, Strong refs et red words;
- le mode annotation exige la geometrie precise des mots et lignes;
- les commentaires M.Henry utilisent du HTML et des liens internes dans `src/features/bible/BibleDOM/Comment.tsx`;
- le mode parallele horizontal synchronise un header sticky avec le scroll du contenu;
- l'interlineaire est une UI specialisee avec cellules lexicales et etat de selection;
- la gestion de gestes actuelle est plus fine que des `onPress` simples.

Pour ces points, un Expo module Android custom est plus approprie: Kotlin + Jetpack Compose natif, avec un composant React Native exporte, des props typees et des callbacks d'evenements.

## Architecture cible proposee

### Couche TypeScript

Creer un adaptateur du type:

- `src/features/bible/nativeBible/NativeBibleReader.tsx`
- `src/features/bible/nativeBible/types.ts`
- `src/features/bible/nativeBible/toNativeBiblePayload.ts`

Responsabilites:

- recevoir les memes donnees que `BibleDOMWrapper`;
- normaliser les donnees en payload serialisable;
- exposer les callbacks qui correspondent aux actions de `src/features/bible/BibleDOM/dispatch.ts`;
- choisir le rendu selon plateforme et feature flag:
  - Android natif Compose si active;
  - `BibleDOMWrapper` sinon.

`BibleViewer.tsx` resterait proprietaire de la navigation, des modales, des Redux actions et des loaders. Cela evite de dupliquer toute la logique metier en Kotlin.

### Couche Android Compose

Deux niveaux possibles:

1. Prototype `@expo/ui/jetpack-compose`:
   - `Host`;
   - `LazyColumn`;
   - composants Compose Expo UI pour ligne de verset;
   - evenements simples vers JS.

2. Module Expo custom:
   - `BibleReaderView` expose par Expo Modules API;
   - `LazyColumn` ou `LazyListState`;
   - `AnnotatedString` pour spans Strong/red words/highlights;
   - `TextLayoutResult` conserve par verset pour annotations;
   - overlay `Canvas` pour highlights mot-a-mot;
   - gestures Compose (`pointerInput`, tap/doubleTap/longPress/drag);
   - callbacks JS: `onAction`, `onSelectionChanged`, `onCreateAnnotation`, `onEraseSelection`, `onVisibleVerseChanged`.

Le module custom devrait etre considere comme l'architecture cible si l'objectif est de remplacer le lecteur actuel, pas seulement de tester Compose.

## Contrat de donnees a migrer

Entrees minimales:

- `book`, `chapter`, `version`, `settings`;
- `verses`;
- `selectedVerses`;
- `highlightedVerses`;
- `notedVersesCount`, `notedVersesText`;
- `linkedVersesCount`, `linkedVersesText`;
- `studyRelationsCount`;
- `bookmarkedVerses`;
- `taggedVerses`, `taggedVersesInChapter`, `versesWithNonHighlightTags`;
- `pericopeChapter`;
- `comments`;
- `redWords`;
- `focusVerses`, `isReadOnly`, `isSelectionMode`;
- `parallelVerses`, `parallelColumnWidth`, `parallelDisplayMode`;
- `wordAnnotations`, `wordAnnotationsInOtherVersions`;
- `annotationMode`, `selectedAnnotationId`, triggers d'annotation.

Sorties/evenements:

- `TOGGLE_SELECTED_VERSE`;
- `NAVIGATE_TO_BIBLE_VERSE_DETAIL`;
- `NAVIGATE_TO_STRONG`;
- `NAVIGATE_TO_VERSION`;
- `ADD_PARALLEL_VERSION`, `REMOVE_PARALLEL_VERSION`;
- `NAVIGATE_TO_BIBLE_NOTE`, `NAVIGATE_TO_BIBLE_LINK`;
- `NAVIGATE_TO_VERSE_LINKS`, `NAVIGATE_TO_VERSE_STUDY_RELATIONS`;
- `OPEN_BOOKMARK_MODAL`, `OPEN_VERSE_TAGS_MODAL`, `OPEN_VERSE_NOTES_MODAL`;
- `OPEN_CROSS_VERSION_MODAL`;
- `SWIPE_LEFT`, `SWIPE_RIGHT`, `SWIPE_UP`, `SWIPE_DOWN`;
- `ENTER_ANNOTATION_MODE`, `SELECTION_CHANGED`, `CREATE_ANNOTATION`, `ERASE_SELECTION`, `ANNOTATION_SELECTED`;
- `TOGGLE_INT_COMPLETE`.

Le contrat actuel est visible dans `src/features/bible/BibleDOM/BibleDOMWrapper.tsx` et `src/features/bible/BibleDOM/dispatch.ts`.

## Code a migrer ou reimplementer

### Reutilisable en TypeScript

- Chargement des donnees: `src/features/bible/bibleReadingChapter.ts`.
- Acces SQLite regular versions: `src/helpers/biblesDb.ts`.
- Chargement Strong/interlineaire: `src/helpers/loadStrongChapter.ts`, `src/helpers/loadInterlineaireChapter.ts`.
- Selecteurs Redux deja agreges dans `BibleViewer.tsx`.
- Calculs de metadonnees: `src/features/bible/BibleDOM/computeVerseMetadata.ts`.
- Tokenisation logique: `~helpers/wordTokenizer` peut rester en TS si les ranges sont calculees cote JS, ou etre portee en Kotlin pour annotations natives.

### A reimplementer en Compose

- `BibleDOMComponent.tsx`: container, scroll, sticky header, gestures.
- `UnifiedVersesRenderer.tsx`: boucle de rendu des versets.
- `Verse.tsx`: texte riche, decorations, metadata inline.
- `verseToStrong.tsx`: parsing et spans cliquables Strong.
- `verseToRedWords.tsx`: ranges rouges.
- `InterlinearVerse.tsx`, `InterlinearVerseComplete.tsx`: UI interlineaire.
- `Comment.tsx`: rendu HTML/commentaires et liens bibliques internes.
- `AnnotationMode/**`: gestures, selection, rects et overlay.

## Gaps majeurs et risques

### 1. Annotation mot-a-mot

Risque eleve. Le DOM donne aujourd'hui gratuitement les rectangles visuels exacts du texte apres layout. Compose demande de gerer explicitement:

- mapping texte source -> tokens -> offsets de caracteres;
- `TextLayoutResult` par verset;
- rectangles multi-lignes;
- selection multi-versets;
- handles de selection;
- overlay synchronise avec scroll;
- recalcul apres changement de font, theme, lineHeight, orientation, Strong refs, tags inline.

Ce chantier doit etre isole et benchmarke avant de promettre une parite fonctionnelle.

### 2. Strong refs et texte riche

Les versions `LSGS` et `KJVS` transforment les numeros Strong en spans cliquables (`verseToStrong.tsx`). En Compose, il faudra un modele de spans interactifs. Un simple `Text` ne suffit pas si plusieurs zones cliquables coexistent dans un verset avec selection et annotation.

### 3. Commentaires HTML

`Comment.tsx` utilise `dangerouslySetInnerHTML` et attache des listeners sur les liens. Compose n'a pas de rendu HTML equivalent complet sans parseur/interpreteur. Options:

- garder les commentaires dans une WebView secondaire;
- parser un sous-ensemble HTML en modele natif;
- afficher un rendu texte simplifie en MVP.

### 4. Mode parallele horizontal

Le DOM utilise CSS sticky + scroll horizontal + synchronisation de header. En Compose, le mode vertical est simple; le mode horizontal demande une architecture dediee avec `LazyRow`, `HorizontalScroll`, largeur de colonnes et synchronisation entre titres et contenu.

### 5. Interlineaire

Les donnees interlineaires sont encodees dans `Texte` avec `@` et `#`. Le rendu est faisable en Compose, mais ce n'est pas le meme composant qu'un verset normal. Il doit etre traite comme une sous-feature.

### 6. Bridge JS <-> natif

Un payload de chapitre contient beaucoup de donnees. Si tout est serialise a chaque changement de selection, le gain de performance du natif peut etre perdu. Il faudra:

- separer payload statique du chapitre et etat interactif;
- envoyer des deltas pour selection/highlights/annotation;
- eviter de reserialiser tous les versets lors d'une interaction locale;
- mesurer le cout du bridge.

### 7. Parite UI et accessibilite

Le lecteur actuel a beaucoup de micro-comportements implicites: opacity de selection, fade read-only, focus verse, scroll to verse, liens inline, tags inline, notes inline, haptics iOS uniquement, aide Android < 30. La migration doit lister ces comportements en tests de regression.

## Estimation par phases

### Phase 0 - Preparation SDK 56 et spike technique

Effort: 2 a 4 jours.

- Mettre a jour une branche vers Expo SDK 56.
- Installer `@expo/ui`.
- Verifier les types reels du package dans `node_modules/@expo/ui`.
- Creer un ecran interne/prototype Android avec `Host` + `LazyColumn`.
- Mesurer rendu d'un chapitre long, theme, scroll, font Literata.

Livrable: preuve que Compose s'integre dans l'app sans conflit avec Expo Router, new architecture, bottom sheets et navigation.

### Phase 1 - Lecteur Compose read-only simple

Effort: 1 a 2 semaines.

- Adapter `BibleViewer.tsx` pour choisir `NativeBibleReader` via feature flag Android.
- Rendre versets normaux, pericopes, highlights de versets, focus/read-only, scroll to verse.
- Remonter tap verset -> detail Strong/resources.
- Garder notes/liens/tags sous forme de compteurs simples.
- Fallback WebView pour versions interlineaires, commentaires et annotations.

Livrable: lecteur natif utilisable pour lecture simple.

### Phase 2 - Metadata et actions de verset

Effort: 1 a 2 semaines.

- Notes, liens, tags, bookmarks, relations d'etude.
- Selection multi-versets.
- Actions vers modales existantes.
- Red words.
- Strong refs cliquables pour `LSGS`/`KJVS`.

Livrable: parite fonctionnelle courante hors annotation mot-a-mot et modes complexes.

### Phase 3 - Parallele et interlineaire

Effort: 2 a 4 semaines.

- Mode parallele vertical d'abord.
- Evaluer mode horizontal: soit Compose dedie, soit abandon/UX alternative sur Android.
- Rendu interlineaire compact/complet.
- Selection Strong dans l'interlineaire.

Livrable: couverture des modes d'etude biblique principaux.

### Phase 4 - Annotation mot-a-mot native

Effort: 4 a 8 semaines selon exigence de parite.

- Port tokenisation/ranges.
- `TextLayoutResult` par verset.
- Overlay Canvas pour background/underline/circle.
- Gestes tap/double tap/long press/drag/handles.
- Creation, effacement, selection et edition d'annotations.
- Tests sur RTL hebreu, Strong refs, font scale, line height, orientation.

Livrable: remplacement credible du mode annotation DOM.

### Phase 5 - Stabilisation et suppression WebView partielle

Effort: 1 a 2 semaines.

- Mesures FPS/memoire/startup.
- Regression QA sur les flows documentes dans `docs/assets/app-flows/screenshots`.
- Feature flag rollout Android.
- Garder fallback DOM pour les cas non couverts jusqu'a stabilisation.

## Strategie de test

- Tests unitaires TS pour la conversion `WebViewProps -> NativeBiblePayload`.
- Tests de snapshot logique sur metadata verse par verse.
- Tests Android instrumentes pour scroll to verse, tap verset, selection multi-versets.
- Tests manuels obligatoires:
  - chapitre long;
  - version Strong;
  - version hebraique RTL;
  - interlineaire;
  - commentaires;
  - annotations;
  - mode parallele;
  - changement theme/font/lineHeight;
  - onglets multiples.

## Decision recommandee

Ne pas lancer une migration complete immediate de `BibleDOM` vers `@expo/ui/jetpack-compose`. Le risque est trop concentre sur les annotations mot-a-mot et les comportements DOM. En revanche, il est pertinent de lancer un spike Android SDK 56 + Compose, puis un lecteur natif read-only derriere feature flag.

La trajectoire recommandee:

1. Court terme: prototype `Host` + `LazyColumn` pour lecture simple.
2. Moyen terme: Expo module Compose custom pour un `BibleReaderView` Android.
3. Long terme: migrer annotations seulement apres validation de la geometrie texte Compose.

Le critere de go/no-go doit etre la parite de l'annotation mot-a-mot. Si Compose ne permet pas une implementation robuste et maintenable de cette partie, garder le WebView pour l'annotation ou pour certains modes restera plus rationnel que de forcer une migration totale.
