# Audit iOS SwiftUI - migration de BibleViewer vers un composant Bible natif

Date: 2026-05-21  
Périmètre: iOS uniquement. L'audit Android Compose est traité séparément.

## Synthèse

La migration iOS est faisable, mais elle ne doit pas être abordée comme une simple conversion de `BibleDOM` vers `@expo/ui/swift-ui`. Le lecteur actuel est un moteur de rendu DOM complet, avec mesure de texte, hit-testing mot par mot, scroll contrôlé, annotations, affichage Strong/interlinéaire, indicateurs de notes/liens/tags/signets, versions parallèles et un bridge d'événements très large. Pour obtenir un composant Bible natif robuste, la voie pragmatique est un module Expo natif custom côté iOS, exposant une vue SwiftUI ou UIKit via SwiftUI, et non une composition pure de composants `@expo/ui/swift-ui` écrite depuis JSX.

Recommandation: conserver `BibleViewer.tsx` comme orchestrateur React Native au début, extraire un contrat de données stable, puis remplacer progressivement `BibleDOMWrapper` par `NativeBibleReaderIOS`. Le rendu riche devrait être implémenté avec TextKit/`UITextView`/`UICollectionView` encapsulé dans SwiftUI si l'objectif inclut les annotations mot par mot. SwiftUI pur peut couvrir le shell, les états simples et quelques layouts, mais TextKit donne de meilleurs primitives pour les rects de glyphes, la sélection, RTL et le mapping coordonnées -> caractère.

## Sources prises en compte

- Documentation Expo SDK 56 fournie: `@expo/ui/swift-ui`, bundle environ `56.0.8`, inclus dans Expo Go, installation `npx expo install @expo/ui`.
- Contraintes Expo UI SDK 56 fournies: chaque arbre SwiftUI doit être dans `Host`; props disponibles ou confirmées: `matchContents`, `onLayoutContent`, `useViewportSizeMeasurement`, `colorScheme`, `layoutDirection`, `ignoreSafeArea`.
- Extension custom SwiftUI possible via modules Expo / Expo UI extending.
- Code local inspecté:
  - `src/features/bible/BibleViewer.tsx`
  - `src/features/bible/SharedBibleDOM.tsx`
  - `src/features/bible/BibleDOM/BibleDOMWrapper.tsx`
  - `src/features/bible/BibleDOM/BibleDOMComponent.tsx`
  - `src/features/bible/BibleDOM/UnifiedVersesRenderer.tsx`
  - `src/features/bible/BibleDOM/Verse.tsx`
  - `src/features/bible/BibleDOM/AnnotationMode/**`
  - `src/features/bible/hooks/useAnnotationMode.ts`
  - `src/features/bible/bibleReadingChapter.ts`

Note: aucune commande réseau n'a été lancée.

## État actuel du lecteur Bible

`BibleViewer.tsx` charge le chapitre principal, puis hydrate en arrière-plan les versions parallèles, les versets secondaires interlinéaires, les commentaires et les paroles en rouge (`src/features/bible/BibleViewer.tsx:378`, `src/features/bible/BibleViewer.tsx:424`, `src/features/bible/bibleReadingChapter.ts:32`). Il agrège aussi les données utilisateur depuis Redux: highlights, notes, liens, relations d'étude, annotations de mots, signets et tags (`src/features/bible/BibleViewer.tsx:336`).

`BibleDOMWrapper` est le bridge entre React Native et le DOM. Il stabilise l'envoi des versets, attend que le DOM signale son montage, applique un watchdog anti-écran blanc, réduit les settings sérialisés, pré-calcule des métadonnées, puis passe un gros paquet de props au composant DOM (`src/features/bible/BibleDOM/BibleDOMWrapper.tsx:335`, `src/features/bible/BibleDOM/BibleDOMWrapper.tsx:343`, `src/features/bible/BibleDOM/BibleDOMWrapper.tsx:660`, `src/features/bible/BibleDOM/BibleDOMWrapper.tsx:686`).

`SharedBibleDOM` maintient une seule instance WebView préchauffée et la déplace entre les tabs via `react-native-teleport`, avec un fallback de remount si le DOM ne monte pas (`src/features/bible/SharedBibleDOM.tsx:25`, `src/features/bible/SharedBibleDOM.tsx:55`, `src/features/bible/SharedBibleDOM.tsx:117`). C'est un contournement spécifique au coût et à la fragilité WebView.

`BibleDOMComponent.tsx` est le vrai moteur de rendu. Il gère la sélection, le cache de tokens, les gestes, le scroll, le sticky header des versions parallèles, les rects d'annotations, le scroll vers un verset, le plein écran via vélocité de scroll, et le rendu des versets (`src/features/bible/BibleDOM/BibleDOMComponent.tsx:449`, `src/features/bible/BibleDOM/BibleDOMComponent.tsx:475`, `src/features/bible/BibleDOM/BibleDOMComponent.tsx:704`, `src/features/bible/BibleDOM/BibleDOMComponent.tsx:768`, `src/features/bible/BibleDOM/BibleDOMComponent.tsx:819`, `src/features/bible/BibleDOM/BibleDOMComponent.tsx:889`).

Le rendu d'un verset n'est pas du texte simple. `Verse.tsx` supporte les versions Strong `LSGS`/`KJVS`, les paroles en rouge, les versions parallèles verticales/horizontales, les versions interlinéaires `INT`/`INT_EN`, les signets, notes, liens, relations d'étude, tags et annotations cross-version (`src/features/bible/BibleDOM/Verse.tsx:412`, `src/features/bible/BibleDOM/Verse.tsx:441`, `src/features/bible/BibleDOM/Verse.tsx:564`, `src/features/bible/BibleDOM/Verse.tsx:588`).

## Ce que `@expo/ui/swift-ui` peut apporter

`@expo/ui/swift-ui` est utile pour intégrer des vues SwiftUI dans l'arbre React Native avec `Host`. Les options confirmées (`matchContents`, `onLayoutContent`, `useViewportSizeMeasurement`, `colorScheme`, `layoutDirection`, `ignoreSafeArea`) sont pertinentes pour une première intégration, un prototype de rendu simple ou un composant natif limité.

Usages réalistes:

- Prototype d'un chapitre simple dans un `Host`, avec `ScrollView`/`VStack`/`Text`, thème clair/sombre, RTL de base et retour d'événements simples.
- Remplacement progressif d'éléments périphériques simples par SwiftUI.
- Wrapper JS propre autour d'une vue native custom exposée par un module Expo.

Limite importante: le lecteur Bible actuel dépend de primitives DOM très fines (`Range`, `getClientRects`, `caretRangeFromPoint`, `elementsFromPoint`, `TreeWalker`, événements touch natifs DOM). Une arborescence JSX `@expo/ui/swift-ui` ne donne pas, à elle seule, un équivalent direct pour mesurer précisément des segments de texte, obtenir les rects de chaque mot après wrapping, ou mapper une coordonnée tactile vers un index de mot dans un texte enrichi. Ces points sont le cœur du mode annotation.

## Architecture cible recommandée

### Couche React Native conservée

Garder en TypeScript:

- Chargement des données: `loadBibleReadingMain`, `loadBibleReadingParallelVerses`, `loadBibleReadingSecondaryVerses`, `loadBibleReadingComments`, `loadBibleReadingRedWords`.
- Sélecteurs Redux et persistance utilisateur.
- Modales existantes: notes, liens, Strong, tags, relations d'étude, signets, paramètres.
- Navigation, multi-tabs, footer/header, onboarding, Sentry.
- Contrat d'événements de haut niveau actuellement centralisé dans `BibleDOMWrapper`.

### Nouvelle couche native iOS

Créer un module Expo, par exemple `modules/native-bible-reader`, exposant:

- `NativeBibleReaderView` côté TS.
- `BibleReaderView` côté Swift, présenté via SwiftUI.
- Un noyau de rendu iOS basé sur TextKit 2 ou `UITextView`/`NSTextStorage`/`NSLayoutManager`, éventuellement dans `UIViewRepresentable` si l'enveloppe SwiftUI est conservée.
- Une API props -> native avec un view model normalisé, pas le shape complet actuel de `WebViewProps`.
- Des événements typed vers JS: `onVersePress`, `onVerseLongPress`, `onSwipeChapter`, `onStrongPress`, `onSelectionChanged`, `onCreateAnnotation`, `onEraseSelection`, `onAnnotationPress`, `onOpenNotes`, `onOpenLinks`, `onOpenTags`, `onLayoutReady`.

Le composant React pourrait ensuite choisir par feature flag:

```tsx
{Platform.OS === 'ios' && nativeBibleReaderEnabled ? (
  <NativeBibleReaderIOS {...readerProps} />
) : (
  <BibleDOMWrapper {...domProps} />
)}
```

### Contrat de données minimal

Le bridge devrait recevoir des structures préparées côté JS:

- `chapter`: book, chapter, version, lang, direction.
- `verses`: liste de versets normalisés `{ key, number, text, kind, strongTokens?, interlinearTokens?, redWordRanges? }`.
- `parallelColumns`: versions parallèles et erreurs.
- `display`: thème actif, font family, font scale, line height, text display, align, options notes/liens/tags.
- `selectionState`: versets sélectionnés, focus verses, readonly, selection mode.
- `decorations`: highlights de verset, word annotations, notes counts/text, links counts/text, relations counts, bookmarks, tags, annotations cross-version.
- `commands`: scroll vers verset, clear selection trigger, apply annotation trigger, erase selection trigger.

Il faut éviter d'envoyer l'objet `settings` complet et les maps Redux brutes. `BibleDOMWrapper` a déjà commencé cette logique avec `trimmedSettings` et des métadonnées pré-calculées (`src/features/bible/BibleDOM/BibleDOMWrapper.tsx:365`, `src/features/bible/BibleDOM/BibleDOMWrapper.tsx:660`).

## Gaps majeurs à combler

### 1. Rendu riche et mesure du texte

Le DOM calcule les rects d'annotations avec `document.createRange()` et `Range.getClientRects()` sur des textes parfois fragmentés par Strong/red words (`src/features/bible/BibleDOM/AnnotationMode/useAnnotationHighlights.ts:22`, `src/features/bible/BibleDOM/AnnotationMode/useAnnotationHighlights.ts:160`). En natif iOS, il faut reconstruire cela avec TextKit:

- mapping `verseKey + wordIndex` -> range `NSRange`;
- mapping `NSRange` -> rects de glyphes/lignes;
- fusion des rects sur une même ligne;
- recalcul après changement de taille, thème, police, orientation, contenu Strong/interlinéaire.

C'est le gap technique principal.

### 2. Hit-testing mot par mot

Le DOM utilise une logique spécifique pour contourner les problèmes iOS WebKit: `elementsFromPoint`, validation de `caretRangeFromPoint`, fallback par bounds de caractères (`src/features/bible/BibleDOM/AnnotationMode/domUtils.ts:8`). En natif, il faut une API équivalente: point tactile -> index de caractère -> index de mot -> `WordPosition`.

TextKit permet ce mapping, mais il faut le développer et le tester avec:

- français/anglais;
- hébreu RTL;
- grec;
- Strong avec tokens interactifs;
- textes longs et versets sur plusieurs lignes;
- polices et tailles utilisateur.

### 3. Gestes et conflits scroll/sélection

`useTouchSelection` implémente long press, double tap, swipe chapitre, drag-to-annotate, poignées de sélection et auto-scroll (`src/features/bible/BibleDOM/AnnotationMode/useTouchSelection.ts:10`, `src/features/bible/BibleDOM/AnnotationMode/useTouchSelection.ts:292`). En SwiftUI pur, les compositions de `Gesture` deviennent vite fragiles sur un long texte scrollable. Une vue UIKit encapsulée donnera plus de contrôle sur `touchesBegan/Moved/Ended`, `UIGestureRecognizer`, scroll et auto-scroll.

### 4. Versions parallèles

Le mode parallèle horizontal synchronise un header sticky et un scroll horizontal document-level (`src/features/bible/BibleDOM/BibleDOMComponent.tsx:768`, `src/features/bible/BibleDOM/Verse.tsx:496`). En natif, il faut choisir entre:

- `UICollectionView` avec sections/colonnes synchronisées;
- `ScrollView` horizontal contenant des colonnes verticales;
- rendu vertical uniquement en V1 native pour réduire le risque.

Le mode parallèle est à exclure du premier jalon si l'objectif est de livrer vite un lecteur natif fiable.

### 5. Interlinéaire et Strong

L'interlinéaire parse un format texte compact avec séparateurs `@` et `#`, affiche des tuiles par mot et ouvre Strong au tap (`src/features/bible/BibleDOM/InterlinearVerse.tsx`, `src/features/bible/BibleDOM/InterlinearVerseComplete.tsx`). Les versions Strong injectent des références interactives au milieu du texte (`src/features/bible/BibleDOM/verseToStrong.tsx`). Il faut transformer ces formats en tokens structurés avant bridge, sinon le natif devra réimplémenter du parsing fragile.

### 6. Parité des décorations

Un verset peut afficher simultanément highlight, numéro coloré, bookmark, compte notes, compte liens, relations, tags, indicateur cross-version, notes inline, liens inline et close-context (`src/features/bible/BibleDOM/Verse.tsx:596`). Cette densité est faisable en natif, mais doit être découpée en modèle de décoration par verset plutôt qu'en traduction ligne-à-ligne du JSX.

## Limites d'Expo UI pour ce cas précis

`@expo/ui/swift-ui` est adapté à des vues SwiftUI déclaratives, mais un lecteur biblique riche demande plus que du layout:

- pas de remplacement direct connu des APIs DOM `Range`, `getClientRects`, `caretRangeFromPoint`;
- bridge de props potentiellement lourd si chaque changement d'annotation ou de sélection renvoie tout le chapitre;
- gestion fine des gestes dans un long `ScrollView` plus risquée en SwiftUI pur;
- besoin de contrôle sur typographie, rects de glyphes, sélection, auto-scroll et accessibilité texte;
- complexité pour maintenir une parité exacte des versions parallèles et interlinéaires.

Donc `Host` et `@expo/ui/swift-ui` peuvent servir d'intégration ou de prototype, mais la version de production devrait passer par un composant natif custom. L'extension SwiftUI via module Expo est la bonne porte d'entrée, avec TextKit sous le capot si nécessaire.

## Plan de migration par phases

### Phase 0 - Contrat et mesures de référence: 3 à 5 jours

- Documenter le contrat actuel `WebViewProps` -> `BibleReaderProps`.
- Ajouter un feature flag iOS sans changer le comportement par défaut.
- Capturer des scénarios de référence: chapitre simple, Strong, interlinéaire, annotations, sélection, versions parallèles, focus readonly.
- Définir les métriques: temps d'ouverture chapitre, scroll FPS perçu, stabilité montage, précision hit-testing.

### Phase 1 - Prototype SwiftUI simple: 1 à 2 semaines

- Installer `@expo/ui` lors du passage SDK 56.
- Créer un prototype iOS dans `Host` avec rendu chapitre simple: versets, thème, font scale, scroll vers verset.
- Utiliser `layoutDirection`, `colorScheme`, `ignoreSafeArea` et `onLayoutContent` pour valider l'intégration.
- Événements minimum: tap verset, long press verset, swipe chapitre.

Critère de sortie: lecture simple utilisable sur iOS, sans annotations mot par mot, sans interlinéaire, sans parallèle.

### Phase 2 - Module Expo custom et TextKit: 2 à 4 semaines

- Créer `NativeBibleReaderIOS`.
- Mapper `AttributedString`/`NSAttributedString` depuis le modèle JS.
- Implémenter rects pour highlights de verset et word annotations.
- Implémenter hit-testing point -> mot.
- Événements `onSelectionChanged`, `onCreateAnnotation`, `onAnnotationPress`.

Critère de sortie: annotations mot par mot fiables sur chapitres simples LSG/KJV et thèmes principaux.

### Phase 3 - Parité fonctionnelle progressive: 3 à 6 semaines

- Ajouter Strong tokens.
- Ajouter red words.
- Ajouter notes/liens/tags/bookmarks/relations.
- Ajouter focus readonly et close context.
- Ajouter RTL hébreu et grec.
- Ajouter interlinéaire compact puis complet.

Critère de sortie: le composant natif couvre le mode lecture principal sans régression majeure.

### Phase 4 - Versions parallèles et remplacement contrôlé: 2 à 4 semaines

- Implémenter les versions parallèles, idéalement vertical d'abord puis horizontal.
- Remplacer `SharedBibleDOM` sur iOS ou le garder uniquement comme fallback WebView.
- Activer le feature flag pour un groupe de test.
- Supprimer progressivement les chemins DOM iOS si la stabilité est prouvée.

## Code à migrer ou à conserver

À conserver côté TS:

- `src/features/bible/BibleViewer.tsx`: orchestration, chargement, selectors, modales.
- `src/features/bible/bibleReadingChapter.ts`: chargement principal et extras.
- `src/features/bible/hooks/useAnnotationMode.ts`: peut rester comme état React au début, mais son contrat doit être renommé pour ne plus supposer WebView.
- `src/redux/selectors/bible.ts` et modules user: source de vérité utilisateur.

À remplacer côté iOS:

- `src/features/bible/BibleDOM/BibleDOMComponent.tsx`: moteur de rendu et gestes.
- `src/features/bible/BibleDOM/Verse.tsx`: rendu natif des versets.
- `src/features/bible/BibleDOM/AnnotationMode/useAnnotationHighlights.ts`: rects TextKit.
- `src/features/bible/BibleDOM/AnnotationMode/domUtils.ts`: hit-testing TextKit.
- `src/features/bible/BibleDOM/AnnotationMode/useTouchSelection.ts`: recognizers natifs.

À transformer en logique partagée:

- `src/helpers/wordTokenizer.ts`: conserver la sémantique des `wordIndex`, mais vérifier Unicode/RTL. Le même algorithme doit être disponible côté Swift ou les ranges doivent être préparés en JS.
- `src/features/bible/BibleDOM/computeVerseMetadata.ts`: garder côté JS; c'est une bonne préparation pour un bridge natif.
- Parsing Strong/interlinéaire: produire des tokens structurés en JS avant bridge.

## Risques

- Risque de sous-estimation: élevé. Le viewer actuel n'est pas un composant texte simple, c'est un moteur de lecture annotable.
- Risque de parité annotations: élevé. Les annotations stockent des `wordIndex`; tout changement de tokenisation ou de mapping texte peut déplacer les annotations existantes.
- Risque RTL/interlinéaire: moyen à élevé. Hébreu et interlinéaire imposent des layouts et hit-tests spécifiques.
- Risque bridge/performance: moyen. Un chapitre complet avec décorations et versions parallèles peut devenir volumineux. Il faudra des modèles diffables ou des updates ciblées.
- Risque maintenance multi-plateforme: élevé si iOS et Android divergent dans la tokenisation, les événements et les règles de sélection.
- Risque Expo SDK: moyen. Le projet est actuellement en Expo SDK 54 (`package.json`), alors que l'audit cible SDK 56. Le jalon technique doit inclure la montée SDK avant tout engagement de production.

## Décision recommandée

Ne pas lancer une migration complète immédiate de `BibleDOM` vers `@expo/ui/swift-ui`. Lancer d'abord un spike iOS natif limité, avec un contrat de données stable et un fallback DOM conservé.

La cible viable est:

1. `BibleViewer.tsx` continue de piloter l'état.
2. Un adaptateur `BibleReaderProps` découple le viewer du DOM.
3. iOS reçoit un `NativeBibleReaderIOS` via module Expo custom.
4. SwiftUI sert d'enveloppe d'intégration, TextKit/UIKit sert au rendu texte riche.
5. `@expo/ui/swift-ui` sert au prototype et éventuellement aux composants natifs simples, pas au moteur complet.

Go recommandé pour un POC en 2 semaines: chapitre simple + tap/long press + scroll vers verset + thème + un type de highlight.  
No-go temporaire pour une migration complète tant que le POC n'a pas prouvé le hit-testing mot par mot et les rects d'annotations sur iOS.
