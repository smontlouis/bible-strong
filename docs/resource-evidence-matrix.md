# Matrice de parcours des ressources

Cette matrice décrit le contrat partagé par les parcours mobile. Les identités exactes restent
dans `packages/resource-catalog/src/mobile-resource-catalog.json` et dans le contrat Maker
`config/mobile-resource-required-ids.json` : le smoke de réconciliation vérifie qu'il y en a 72,
une seule fois chacune.

| Famille | Identités couvertes | Surfaces consommatrices | Accès partagé |
| --- | --- | --- | --- |
| Bibles texte | `bible:*` (47 versions) | lecteur, comparaison, sélection de version, péricopes, recherche, détail d'un verset, onboarding et téléchargements | `bibleContent`, `bibleReading`, `bibleSearch` |
| Bibles Strong | `bible-strong:*` (12 versions) | lecteur Strong, concordance, compteurs, occurrences, mode Strong, sélecteur de version | `strongBible` + `bibleContent` |
| BHG interlinéaire | `bible-interlinear:BHG:fr`, `bible-interlinear:BHG:en` | modes interlinéaire, translittération et Strong, lexique interlinéaire | `interlinearBible`, `lexiconBible` |
| Lexique Strong | `strong-lexicon:core`, `strong-lexicon:resources`, `strong-lexicon:entities` | accueil, recherche, entrée, morphologies, relations, entités et entités de chapitre | `strongLexicon` |
| Dictionnaire | `database:DICTIONNAIRE:fr`, `database:DICTIONNAIRE:en` | liste, recherche, détail, mots d'un verset, accueil | `dictionary` |
| Nave | `database:NAVE:fr`, `database:NAVE:en` | liste, recherche, détail, modal, thèmes d'un verset, accueil | `nave` |
| Commentaire | `database:MHY:fr` | onglet commentaire et commentaire de chapitre | `commentary` / `bibleReading` |
| Références | `database:TRESOR:fr` | carte de référence et liens de versets | `bibleReading.loadTresorReferences` |
| Chronologie | `database:TIMELINE:fr`, `database:TIMELINE:en` | widget d'accueil, liste et détail | `timeline` |

## Règles de parcours

- Une copie locale valide est utilisée en priorité pour une lecture.
- Sans copie locale, une source HTTP configurée peut satisfaire la lecture sans téléchargement.
- Une recherche utilise la source HTTP en ligne puis revient à SQLite si le service échoue et que
  SQLite est disponible.
- Hors ligne, une copie absente ou invalide affiche l'état partagé avec l'action de récupération
  appropriée ; une absence réelle et une panne temporaire restent distinctes.
- L'onboarding est facultatif : l'utilisateur peut continuer en ligne sans télécharger, ou ouvrir
  la préparation hors-ligne.
- Les téléchargements, mises à jour, suppressions et reprises passent par la file de téléchargements
  et le modèle `ResourceAccess`, jamais par un test de fichier dans un écran.

## Preuves locales non-E2E

```bash
yarn resources:architecture:check
yarn typecheck
yarn format:check
```

Le réconciliateur Maker fournit la preuve d'inventaire (`72/72`, aucun doublon ou manque). Les
smoke scripts de l'API couvrent Bible/recherche, dictionnaire, Nave, commentaires/références,
chronologie et lexique Strong. Les interactions iOS/Android restent volontairement une étape
manuelle séparée.
