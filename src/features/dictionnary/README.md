# Feature Dictionary

## Vue d'ensemble

La feature Dictionary (Dictionnaire) fournit un accès au dictionnaire biblique Westphal, permettant aux utilisateurs de rechercher et consulter des définitions détaillées de termes, personnages et concepts bibliques.

## Fonctionnalités principales

### Navigation et recherche
- Liste alphabétique des entrées
- Recherche par mot-clé
- Navigation par lettre (A-Z)
- Historique de consultation
- Suggestions de mots similaires

### Affichage du contenu
- Définitions détaillées avec formatage HTML
- Références bibliques cliquables
- Liens vers d'autres entrées du dictionnaire
- Support des tags utilisateur
- Mode de lecture optimisé

### Actions utilisateur
- Marquer des entrées avec des tags personnalisés
- Partager des définitions
- Ouvrir dans un nouvel onglet
- Copier le contenu
- Navigation vers les versets référencés

## Architecture

### Structure des composants

```
dictionnary/
├── DictionaryTabScreen         # Liste principale avec alphabet
│   ├── DictionnaireItem       # Élément de liste
│   └── SearchBar              # Barre de recherche
├── DictionaryDetailTabScreen   # Vue détaillée d'une entrée
│   ├── WebView               # Affichage HTML du contenu
│   ├── Header                # En-tête avec actions
│   └── TagSelector           # Sélection de tags
├── Cards/
│   ├── DictionnaireCard      # Carte de contenu
│   └── DictionnaireVerseDetailCard # Carte pour versets
├── DictionnaryResultsWidget   # Widget résultats de recherche
└── waitForDictionnaireDB.tsx  # HOC pour chargement DB
```

### Structure de la base de données

```typescript
interface DictionaryEntry {
  id: string              // Identifiant unique
  word: string            // Mot ou terme
  definition: string      // Contenu HTML
  letter: string          // Première lettre (A-Z)
  references?: string[]   // Références bibliques
  relatedWords?: string[] // Mots liés
}
```

### Gestion d'état

- **Redux** :
  - Tags utilisateur dans `state.user.bible.dictionnary`
  - Historique de consultation
  
- **État local** :
  - Résultats de recherche
  - Lettre sélectionnée
  - État de chargement

## Base de données

### Chargement
```typescript
// HOC pour s'assurer du chargement
export default waitForDictionnaireDB(DictionaryTabScreen)

// Fonctions de chargement
loadDictionnaireByLetter(letter: string): Promise<Entry[]>
loadDictionnaireBySearch(query: string): Promise<Entry[]>
loadDictionnaireWord(wordId: string): Promise<Entry>
```

### Gestion des erreurs
- Détection de base corrompue
- Message d'erreur utilisateur
- Fallback gracieux

## Utilisation

### Recherche d'un mot
```typescript
// Recherche par lettre
const words = await loadDictionnaireByLetter('A')

// Recherche par mot-clé
const results = await loadDictionnaireBySearch('amour')
```

### Navigation vers une définition
```typescript
navigation.navigate('DictionnaryDetail', {
  word: selectedWord
})
```

### Gestion des liens internes
```typescript
// Dans la WebView
const handleMessage = (event) => {
  const { type, payload } = JSON.parse(event.nativeEvent.data)
  
  if (type === 'navigate-to-verse') {
    navigateToBibleVerse(payload)
  } else if (type === 'navigate-to-word') {
    navigateToDictionaryWord(payload)
  }
}
```

## WebView et affichage

### Injection CSS
```css
/* Styles adaptés au thème */
body {
  font-family: -apple-system, BlinkMacSystemFont;
  color: ${theme.colors.text};
  background: ${theme.colors.background};
}

/* Liens cliquables */
a.verse-link {
  color: ${theme.colors.primary};
  text-decoration: underline;
}
```

### Communication WebView
```javascript
// Envoi de message depuis la WebView
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'navigate-to-verse',
  payload: { book: 43, chapter: 3, verse: 16 }
}))
```

## Performance

### Optimisations
- **Section List** : Utilisation de `getItemLayout` pour performances
- **Lazy loading** : Chargement par lettre à la demande
- **Cache** : Mise en cache des définitions consultées
- **Debounce** : Sur la recherche (300ms)

### Index alphabétique
```typescript
const sections = [
  { title: 'A', data: wordsStartingWithA },
  { title: 'B', data: wordsStartingWithB },
  // ...
]
```

## Intégrations

### Avec la Bible
- Navigation vers les versets référencés
- Affichage des versets dans le contexte
- Support des références multiples

### Avec les études
- Possibilité d'insérer des définitions dans les études
- Liens depuis les études vers le dictionnaire

### Avec le système de tags
- Tags partagés avec les autres features
- Filtrage par tags
- Synchronisation Firebase

## Points d'extension

Pour enrichir le dictionnaire :
1. Ajouter de nouvelles entrées dans la DB
2. Implémenter des catégories thématiques
3. Ajouter des illustrations ou médias
4. Créer des liens vers d'autres ressources

## Configuration

### Paramètres disponibles
- Taille de police pour la lecture
- Thème d'affichage (clair/sombre)
- Affichage des références inline/footnote

## Dépendances clés

- `react-native-webview` : Affichage du contenu HTML
- `react-native-section-list-get-item-layout` : Optimisation liste
- Base de données SQLite locale
- `expo-haptics` : Retour haptique
- Système de tags partagé avec l'app