# Feature Bible

## Vue d'ensemble

La feature Bible est le cœur de l'application Bible Strong. Elle fournit une expérience de lecture complète et interactive de la Bible avec support pour multiples versions, annotations, audio et outils d'étude avancés.

## Fonctionnalités principales

### Navigation biblique
- Navigation intuitive par livre, chapitre et verset
- Support des gestes de swipe pour naviguer entre chapitres
- Historique de navigation avec accès rapide
- Système d'onglets permettant plusieurs Bibles ouvertes simultanément

### Affichage du texte
- Support de multiples versions bibliques (LSG, Martin, Darby, etc.)
- Mode parallèle pour comparer plusieurs versions côte à côte
- Affichage interlinéaire (texte original avec traduction)
- Personnalisation de la taille de police et de l'interligne

### Annotations et étude
- Système de surlignage avec 8 couleurs prédéfinies
- Prise de notes sur les versets
- Tags personnalisés pour catégoriser les versets
- Lexique Strong intégré (concordance hébraïque/grecque)
- Commentaires bibliques intégrés

### Audio
- Lecture audio des chapitres (streaming ou TTS)
- Contrôles de lecture avancés (vitesse, pause, navigation)
- Suivi automatique du verset en cours de lecture
- Mode lecture continue

### Outils de recherche
- Recherche dans le texte biblique
- Concordance pour trouver les occurrences d'un mot
- Comparaison de versets entre différentes versions
- Péricopes (sections thématiques)

## Architecture

### Structure des composants

```
BibleScreen/
├── BibleTabScreen          # Gestion des onglets et configuration
├── BibleViewer            # Orchestrateur principal
│   ├── BibleHeader        # Navigation et actions
│   ├── BibleDOM/          # Rendu du contenu biblique
│   │   ├── BibleDOMWrapper
│   │   ├── Verse
│   │   └── InterlinearVerse
│   └── BibleFooter        # Contrôles audio et navigation
├── Selectors/             # Composants de sélection
│   ├── BookSelector
│   ├── ChapterSelector
│   └── VerseSelector
├── Modals/                # Interfaces modales
│   ├── BibleNoteModal
│   ├── BibleParamsModal
│   ├── StrongModal
│   └── SelectedVersesModal
└── Screens/               # Écrans spécialisés
    ├── StrongScreen
    ├── CompareVersesScreen
    ├── HistoryScreen
    └── PericopeScreen
```

### Gestion d'état

- **Jotai atoms** : État local des composants
  - `bibleAtom` : État principal de la Bible
  - `historyAtom` : Historique de navigation
  - `multipleTagsModalAtom` : Gestion des tags multiples

- **Redux** : État global persistant
  - Highlights et notes
  - Paramètres utilisateur
  - Historique de lecture

### Navigation

La navigation utilise un système d'actions Redux :
- `NAVIGATE_TO_BIBLE_VIEW` : Navigation vers une référence biblique
- `NAVIGATE_TO_STRONG` : Accès au lexique Strong
- `SWIPE_LEFT/RIGHT` : Navigation entre chapitres
- `SWIPE_UP/DOWN` : Navigation entre livres

## Utilisation

### Afficher un verset spécifique

```typescript
dispatch({
  type: 'NAVIGATE_TO_BIBLE_VIEW',
  payload: {
    book: 43,      // Jean
    chapter: 3,
    verse: 16,
    version: 'LSG'
  }
})
```

### Ouvrir le sélecteur de livre

```typescript
const { open } = useBookAndVersionSelector()
open({
  type: 'book',
  onSelect: (book) => {
    // Navigation vers le livre sélectionné
  }
})
```

### Surligner un verset

```typescript
dispatch(updateHighlight({
  verses: { 'GEN.1.1': true },
  color: 'color-69D2E7'  // Couleur prédéfinie
}))
```

## Personnalisation

### Thèmes disponibles
- `default` : Thème clair par défaut
- `dark` : Mode sombre
- `sepia` : Ton sépia pour une lecture confortable
- `mauve`, `nature`, `night`, `sunset` : Thèmes colorés
- `black` : Contraste élevé

### Paramètres de lecture
- Taille de police : 10 niveaux disponibles
- Interligne : 5 niveaux disponibles
- Mode de lecture : Normal ou Paragraphe
- Affichage des numéros de versets : Activé/Désactivé

## Dépendances clés

- `jotai` : Gestion d'état atomique
- `@gorhom/bottom-sheet` : Bottom sheets natifs
- `expo-haptics` : Retour haptique
- `react-native-webview` : Rendu du contenu biblique

## Points d'extension

Pour ajouter une nouvelle fonctionnalité :
1. Créer le composant dans le dossier approprié
2. Ajouter l'état nécessaire (atom Jotai ou action Redux)
3. Intégrer dans `BibleViewer` si nécessaire
4. Ajouter la navigation si c'est un nouvel écran

## Performance

- Chargement différé des chapitres
- Mise en cache des données bibliques
- Optimisation du rendu avec `React.memo`
- Utilisation de WebView pour le rendu complexe du texte