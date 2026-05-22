# Audit migration native BibleViewer

Date: 2026-05-21  
Périmètre: synthèse des audits iOS SwiftUI et Android Jetpack Compose pour remplacer progressivement le rendu `BibleDOM` par un composant Bible natif.

## Conclusion

La migration vers un lecteur Bible natif est possible, mais elle ne doit pas être lancée comme une réécriture directe de `BibleDOM` avec les composants Expo UI déclaratifs. Le lecteur actuel est un moteur de lecture annotable: rendu riche, versions parallèles, interlinéaire, Strong, commentaires, notes, liens, tags, signets, relations d'étude, sélection multi-versets, annotations mot-à-mot, scroll contrôlé, gestes et bridge d'événements.

La recommandation est de garder `BibleViewer.tsx` comme orchestrateur React Native, d'extraire un contrat `NativeBibleReader`, puis d'implémenter deux composants natifs custom par plateforme:

- iOS: module Expo custom avec SwiftUI comme enveloppe, TextKit/UIKit pour le texte riche, la géométrie des glyphes et le hit-testing mot par mot.
- Android: module Expo custom Jetpack Compose avec `LazyColumn`, `AnnotatedString`, `TextLayoutResult`, overlays `Canvas` et gestures Compose.

`@expo/ui/swift-ui` et `@expo/ui/jetpack-compose` sont utiles pour un spike et pour monter des arbres natifs via `Host`, mais ils ne suffisent probablement pas comme unique couche de production pour le lecteur complet.

## Documents produits

- [Audit iOS SwiftUI](bible-viewer-swiftui-audit.md)
- [Audit Android Jetpack Compose](bible-viewer-compose-audit.md)

## Sources documentaires

- Expo SDK 56 SwiftUI: https://docs.expo.dev/versions/v56.0.0/sdk/ui/swift-ui/
- Expo SDK 56 Jetpack Compose: https://docs.expo.dev/versions/v56.0.0/sdk/ui/jetpack-compose/
- Les deux pages indiquent `@expo/ui` bundle `~56.0.8`, installation `npx expo install @expo/ui`, inclusion dans Expo Go, et l'obligation de wrapper les composants natifs dans `Host`.
- Context7 a confirmé les APIs utiles pour SDK 56: `Host`, `matchContents`, `onLayoutContent`, `useViewportSizeMeasurement`, `colorScheme`, `layoutDirection`, `ignoreSafeArea`, `LazyColumn`, modifiers et extension via modules Expo custom.

## État du projet

Le projet est actuellement sur Expo SDK 54 (`expo@54.0.29`, React Native 0.81.5) et n'a pas encore `@expo/ui` dans `package.json`. Il n'y a pas de dossiers `ios/` ou `android/` suivis dans le dépôt inspecté; la stratégie doit donc rester compatible Expo managed/prebuild et passer par un module Expo ou une intégration configurée proprement.

Le code actuel à haut impact:

- `src/features/bible/BibleViewer.tsx`: orchestration du lecteur, chargement, sélecteurs Redux, modales, actions, onglets, footer/header.
- `src/features/bible/SharedBibleDOM.tsx`: WebView/DOM partagé et préchauffé entre onglets.
- `src/features/bible/BibleDOM/BibleDOMWrapper.tsx`: bridge RN -> DOM, watchdog de montage, pré-calcul des métadonnées.
- `src/features/bible/BibleDOM/BibleDOMComponent.tsx`: moteur DOM de rendu, scroll, gestes, annotations et versions parallèles.
- `src/features/bible/BibleDOM/AnnotationMode/**`: sélection mot-à-mot, rects d'annotations, hit-testing DOM.
- `src/features/bible/hooks/useAnnotationMode.ts`: état React/Redux des annotations mot-à-mot.

## Ce qui peut migrer tôt

Les parties suivantes sont de bons candidats pour un premier lecteur natif sous feature flag:

- rendu d'un chapitre simple;
- typographie, thème, taille de police et line height;
- titres de péricope;
- tap/long press sur un verset;
- scroll vers un verset;
- highlights de verset;
- compteurs simples de notes, liens, tags, signets et relations;
- mode read-only/focus verses;
- red words si les ranges sont préparés côté TypeScript.

Ces éléments permettent de valider la valeur d'un rendu natif sans toucher immédiatement au bloc le plus risqué.

## Ce qui bloque une migration complète

Le bloc critique est le mode annotation mot-à-mot. Le DOM fournit aujourd'hui des primitives fortes: `Range.getClientRects()`, hit-testing par coordonnée, scroll window, events touch et mesures de layout. Une migration native doit reconstruire:

- mapping `verseKey + wordIndex` vers offset caractère;
- mapping offset/range vers rects visuels multi-lignes;
- fusion et dessin des rects background/underline/circle;
- sélection par tap, double tap, long press, drag et poignées;
- auto-scroll pendant sélection;
- compatibilité avec français, anglais, grec, hébreu RTL, Strong, interlinéaire, font scale et orientation.

Tant que ce point n'est pas prouvé par un POC, une migration complète est prématurée.

Autres risques importants:

- versions Strong `LSGS`/`KJVS` avec spans cliquables;
- versions interlinéaires `INT`/`INT_EN`;
- commentaires HTML;
- mode parallèle horizontal avec header sticky synchronisé;
- coût du bridge si tout le chapitre est resérialisé à chaque interaction;
- divergence iOS/Android sur la tokenisation et les ranges d'annotations existantes.

## Architecture cible

Ajouter une frontière explicite autour du rendu:

- `src/features/bible/nativeBible/types.ts`
- `src/features/bible/nativeBible/toNativeBiblePayload.ts`
- `src/features/bible/nativeBible/NativeBibleReader.tsx`

`BibleViewer.tsx` continuerait de charger les données, lire Redux/Jotai, ouvrir les modales et déclencher les actions. `NativeBibleReader` recevrait un payload stable et renverrait des événements typés équivalents aux actions de `src/features/bible/BibleDOM/dispatch.ts`.

Le choix de rendu resterait contrôlé par plateforme et feature flag:

```tsx
{nativeBibleReaderEnabled ? (
  <NativeBibleReader payload={payload} onAction={handleReaderAction} />
) : (
  <BibleDOMWrapper {...domProps} />
)}
```

Cette frontière évite de dupliquer la logique métier dans Swift/Kotlin et garde un fallback WebView tant que la parité n'est pas atteinte.

## Plan recommandé

### Phase 0 - Contrat et SDK 56

Effort estimé: 3 à 5 jours.

- Monter une branche spike Expo SDK 56.
- Installer `@expo/ui`.
- Lire les types réels dans `node_modules/@expo/ui`.
- Extraire un modèle `NativeBiblePayload`.
- Ajouter un feature flag sans changer le comportement par défaut.
- Capturer les scénarios de référence: chapitre simple, Strong, interlinéaire, annotations, parallèle, focus/read-only, changement thème/font.

### Phase 1 - Lecteur natif simple

Effort estimé: 1 à 2 semaines par plateforme.

- iOS: prototype `Host` SwiftUI puis vue custom si besoin.
- Android: prototype `Host` + `LazyColumn`.
- Rendu simple, scroll, tap verset, thème, font scale, highlights de verset.
- Fallback WebView pour annotations mot-à-mot, interlinéaire, parallèle et commentaires.

### Phase 2 - Actions et décorations

Effort estimé: 1 à 2 semaines par plateforme.

- Notes, liens, tags, signets, relations, sélection multi-versets.
- Red words et Strong cliquable.
- Événements vers les modales existantes.
- Updates ciblées pour éviter de resérialiser tout le chapitre.

### Phase 3 - Modes d'étude

Effort estimé: 2 à 4 semaines par plateforme.

- Mode parallèle vertical d'abord.
- Interlinéaire compact puis complet.
- Évaluation du parallèle horizontal: parité exacte ou UX native alternative.

### Phase 4 - Annotation mot-à-mot

Effort estimé: 4 à 8 semaines par plateforme.

- iOS: TextKit/UIKit sous SwiftUI.
- Android: `TextLayoutResult` + overlay `Canvas`.
- Preuve de parité sur tokenisation, rects, hit-testing, sélection, suppression, modification et persistance.

## Critères de go/no-go

Go pour continuer si le spike prouve:

- intégration Expo SDK 56 sans conflit majeur avec Expo Router, new architecture, bottom sheets et navigation;
- scroll natif fluide sur des chapitres longs;
- bridge stable avec payload de chapitre réel;
- tap/long press et scroll-to-verse fiables;
- modèle commun iOS/Android pour les événements.

No-go pour migration complète si:

- les annotations mot-à-mot ne peuvent pas préserver les `wordIndex` existants;
- les rects de texte divergent entre plateformes;
- le bridge annule le gain de performance;
- la maintenance iOS/Android impose deux moteurs métier divergents.

## Décision proposée

Lancer un POC limité, pas une migration complète.

Le POC doit viser un lecteur read-only natif derrière feature flag, en conservant `BibleDOMWrapper` comme fallback. La décision de remplacer le WebView ne doit être prise qu'après validation du cas le plus difficile: annotation mot-à-mot fiable sur iOS et Android.
