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
