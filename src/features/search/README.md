# Feature Search

## Vue d'ensemble

La feature Search permet de rechercher des versets bibliques avec deux modes : recherche en ligne via Algolia et recherche hors ligne avec un index local. Elle offre des filtres avancés et supporte plusieurs langues.

## Fonctionnalités principales

### Modes de recherche
- **Mode en ligne** : Recherche rapide via Algolia avec résultats instantanés
- **Mode hors ligne** : Recherche locale pour une utilisation sans connexion
- Bascule facile entre les deux modes

### Filtres et options
- Filtrage par section : Ancien Testament (AT) ou Nouveau Testament (NT)
- Filtrage par livre spécifique
- Tri par pertinence ou ordre biblique
- Support multilingue (Français avec LSG, Anglais avec KJV)

### Interface utilisateur
- Barre de recherche avec debouncing (300ms)
- Résultats paginés avec scroll infini
- Mise en évidence des termes recherchés
- Navigation directe vers les versets trouvés

## Architecture

### Structure des composants

```
search/
├── SearchTabScreen         # Container principal avec switch mode
├── OnlineSearchScreen      # Recherche Algolia
│   ├── SearchBox          # Barre de recherche
│   ├── Filters            # Filtres AT/NT et livres
│   ├── InfiniteHits       # Résultats avec pagination
│   └── EmptySearch        # État vide
├── LocalSearchScreen       # Recherche hors ligne
│   ├── LocalSearchBox     # Barre de recherche locale
│   └── LocalSearchResults # Affichage des résultats
└── helpers/
    ├── algoliaHelper.ts   # Configuration Algolia
    └── localSearchHelper.ts # Logique de recherche locale
```

### Gestion d'état

- **Jotai Atoms** :
  - `searchAtom` : État de la recherche (query, filters)
  - `isOnlineAtom` : Mode en ligne/hors ligne
  - `historyAtom` : Historique des recherches

- **État local** :
  - Résultats de recherche
  - État de chargement
  - Filtres actifs

## Intégration Algolia

### Configuration
```typescript
const searchClient = algoliasearch(
  APPLICATION_ID,
  SEARCH_API_KEY
)

const index = 'bible-lsg' // ou 'bible-kjv' pour l'anglais
```

### Structure des données indexées
```typescript
interface VerseHit {
  objectID: string        // Ex: "GEN.1.1"
  book: number           // Numéro du livre
  chapter: number        // Numéro du chapitre
  verse: number          // Numéro du verset
  content: string        // Texte du verset
  section: 'AT' | 'NT'   // Section
}
```

## Recherche hors ligne

### Index local
- Fichiers préchargés : `bibleLSG.ts` pour le français
- Chargement asynchrone au démarrage
- Cache en mémoire pour les performances

### Algorithme de recherche
```typescript
// Recherche simple avec normalisation
const normalizedQuery = removeAccents(query.toLowerCase())
const results = verses.filter(verse => 
  removeAccents(verse.content.toLowerCase())
    .includes(normalizedQuery)
)
```

## Utilisation

### Recherche en ligne
```typescript
// Navigation vers la recherche
navigation.navigate('SearchTab')

// Recherche avec InstantSearch
<InstantSearch searchClient={searchClient} indexName="bible-lsg">
  <SearchBox />
  <InfiniteHits />
</InstantSearch>
```

### Recherche hors ligne
```typescript
// Charger l'index
const index = await loadIndexCache()

// Effectuer une recherche
const results = searchInIndex(index, query, filters)
```

### Navigation vers un verset
```typescript
dispatch({
  type: 'NAVIGATE_TO_BIBLE_VIEW',
  payload: {
    book: hit.book,
    chapter: hit.chapter,
    verse: hit.verse
  }
})
```

## Performance

### Optimisations
- **Debouncing** : 300ms pour éviter les requêtes excessives
- **Pagination** : Chargement progressif des résultats
- **Cache** : Index local en mémoire
- **Lazy loading** : Chargement différé de l'index hors ligne

### Gestion des quotas
- Limitation du nombre de requêtes Algolia
- Message d'avertissement en cas de dépassement
- Bascule automatique vers le mode hors ligne

## Configuration

### Variables d'environnement
```
ALGOLIA_APPLICATION_ID=your_app_id
ALGOLIA_SEARCH_API_KEY=your_search_key
```

### Personnalisation
- Nombre de résultats par page : 20
- Délai de debounce : 300ms
- Langues supportées : FR (LSG), EN (KJV)

## Points d'extension

Pour ajouter une nouvelle version biblique :
1. Créer l'index Algolia correspondant
2. Ajouter le fichier d'index local
3. Mettre à jour la configuration
4. Adapter les filtres si nécessaire

## Dépendances clés

- `algoliasearch` : Client Algolia
- `react-instantsearch-native` : Composants de recherche
- `expo-file-system` : Gestion des fichiers d'index
- `lodash` : Utilitaires (debounce)
- `react-i18next` : Internationalisation