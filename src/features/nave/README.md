# Feature Nave

## Vue d'ensemble

La feature Nave implémente une concordance thématique biblique (Nave's Topical Bible) permettant aux utilisateurs d'explorer la Bible par thèmes et sujets. Elle offre une navigation alphabétique et une recherche par mots-clés.

## Fonctionnalités principales

### Navigation thématique
- Liste alphabétique des thèmes bibliques
- Plus de 20 000 références organisées par sujets
- Navigation par lettre (A-Z)
- Recherche textuelle dans les thèmes

### Affichage du contenu
- Définitions et explications thématiques
- Références bibliques groupées par sujet
- Contenu HTML formaté avec liens cliquables
- Support des références croisées entre thèmes

### Intégration contextuelle
- Modal pour afficher les thèmes liés à un verset spécifique
- Ouverture dans un nouvel onglet
- Système de tags pour organiser les thèmes favoris
- Partage du contenu

## Architecture

### Structure des composants

```
nave/
├── Screens/
│   ├── NaveScreen              # Point d'entrée, crée un onglet
│   ├── NaveTabScreen           # Liste principale des thèmes
│   ├── NaveDetailScreen        # Wrapper pour le détail
│   ├── NaveDetailTabScreen     # Vue détaillée d'un thème
│   └── NaveWarningScreen       # Avertissement (version FR)
├── Components/
│   ├── NaveItem                # Élément de liste
│   ├── NaveResultItem          # Résultat de recherche
│   └── NaveResultsWidget       # Widget de résultats
└── Modals/
    ├── NaveModalForVerse       # Modal contextuel pour verset
    ├── NaveModalItem           # Élément dans le modal
    └── NaveModalCard           # Carte modale
```

### Types de données

```typescript
// Onglet de navigation Nave
interface NavesTab {
  id: string
  title: string
  isRemovable: boolean
  hasBackButton: boolean
  type: 'naves'
  data: {}
}

// Onglet de thème spécifique
interface NaveTab {
  id: string
  title: string
  isRemovable: boolean
  hasBackButton: boolean
  type: 'nave'
  data: {
    name_lower: string
    name: string
  }
}

// Structure d'un thème
interface NaveItem {
  name: string          // Nom du thème
  name_lower: string    // Nom en minuscules (recherche)
  description: string   // Contenu HTML
  letter: string        // Lettre initiale
}
```

### Gestion d'état

- **Redux** :
  - Tags utilisateur dans `state.user.bible.nave`
  - Historique de consultation
  
- **Navigation** :
  - Utilise le système d'onglets de l'app
  - Support du back button
  - Onglets temporaires et permanents

## Base de données

### Fonctions d'accès
```typescript
// Chargement par lettre
loadNaveByLetter(letter: string): Promise<NaveItem[]>

// Recherche textuelle
loadNaveBySearch(query: string): Promise<NaveItem[]>

// Thèmes liés à un verset
loadNaveByVerse(verseId: string): Promise<NaveItem[]>

// Détail d'un thème
loadNaveByNameLower(nameLower: string): Promise<NaveItem>
```

### Structure du contenu
- Format HTML avec balises sémantiques
- Liens internes vers d'autres thèmes
- Références bibliques formatées
- Support multilingue (principalement EN)

## Utilisation

### Navigation vers Nave
```typescript
// Ouvrir la liste des thèmes
navigation.navigate('Nave')

// Ouvrir un thème spécifique
dispatch({
  type: 'OPEN_NAVE',
  payload: {
    name: 'Faith',
    name_lower: 'faith'
  }
})
```

### Modal contextuel pour un verset
```typescript
// Afficher les thèmes liés à un verset
<NaveModalForVerse
  verse={verseId}
  onNavigate={(theme) => navigateToTheme(theme)}
/>
```

### Gestion des liens dans WebView
```javascript
// Communication WebView → React Native
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'navigate-to-nave',
  payload: { name_lower: 'grace' }
}))
```

## Intégrations

### Avec la Bible
- Liens directs vers les versets bibliques
- Navigation contextuelle depuis un verset
- Support des références multiples

### Avec le système de tags
- Organisation des thèmes favoris
- Filtrage par tags
- Synchronisation avec Firebase

### Avec le partage
- Export du contenu en texte
- Partage via les apps natives
- Copie dans le presse-papiers

## Points spécifiques

### Avertissement version française
- La base Nave est principalement en anglais
- Un écran d'avertissement informe les utilisateurs FR
- Possibilité de continuer malgré la langue

### Performance
- Chargement par lettre pour optimiser la mémoire
- Cache des thèmes consultés récemment
- Section list optimisée avec `getItemLayout`

### Navigation par onglets
```typescript
// Création d'un onglet temporaire
const tab: NavesTab = {
  id: generateID(),
  title: 'Nave',
  isRemovable: true,
  hasBackButton: true,
  type: 'naves',
  data: {}
}
```

## Configuration

### Personnalisation
- Taille de police héritée des paramètres globaux
- Support du mode sombre
- Couleurs des liens personnalisables

### Limitations
- Contenu principalement en anglais
- Base de données en lecture seule
- Pas de modification des thèmes

## Points d'extension

Pour enrichir la feature :
1. Ajouter une traduction française complète
2. Implémenter des thèmes personnalisés utilisateur
3. Ajouter des médias (images, audio)
4. Créer des parcours thématiques guidés

## Dépendances clés

- `react-native-webview` : Affichage du contenu HTML
- Base de données SQLite locale
- Système de navigation par onglets
- Redux pour la gestion d'état
- `expo-haptics` : Retour haptique