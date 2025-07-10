# Feature Studies

## Vue d'ensemble

La feature Studies permet aux utilisateurs de créer, éditer et partager des études bibliques enrichies. Elle offre un éditeur de texte riche intégré avec des fonctionnalités spécifiques pour l'insertion de contenu biblique, la publication en ligne et l'export PDF.

## Fonctionnalités principales

### Éditeur de texte riche
- Basé sur Quill.js via Expo DOM Components
- Formatage complet : gras, italique, souligné, barré
- Support des listes ordonnées et non ordonnées
- Citations et blocs de code
- Couleurs de texte et arrière-plans personnalisés
- Auto-save avec debounce de 500ms

### Insertion de contenu biblique
- **Liens vers versets** : Référence cliquable vers un verset
- **Blocs de versets** : Insertion du texte complet d'un ou plusieurs versets
- **Liens Strong** : Référence vers le lexique Strong
- **Blocs Strong** : Insertion de la définition complète

### Gestion des études
- Organisation par tags personnalisés
- Tri par date de modification
- Recherche et filtrage par titre et contenu
- Support multi-onglets pour ouvrir plusieurs études
- Suppression avec confirmation

### Publication et partage
- Publication en ligne avec URL unique
- Export au format PDF via Cloud Function
- Partage natif (réseaux sociaux, email, etc.)
- Copie du lien dans le presse-papiers
- Indicateur de statut de publication

## Architecture

### Structure des composants

```
studies/
├── Screens/
│   ├── StudiesScreen           # Point d'entrée navigation
│   ├── StudiesTabScreen        # Wrapper avec logique d'affichage
│   ├── AllStudiesTabScreen     # Liste de toutes les études
│   └── EditStudyScreen         # Écran d'édition/lecture
├── Components/
│   ├── StudyItem               # Carte d'étude dans la liste
│   ├── EditStudyHeader         # En-tête avec titre et actions
│   ├── StudyFooter             # Barre d'outils d'édition
│   └── PublishStudyMenuItem    # Gestion publication/export
├── Modals/
│   ├── StudySettingsModal      # Paramètres de l'étude
│   └── StudyTitlePrompt        # Modification du titre
└── StudiesDOM/                 # Module d'édition Quill.js
    ├── index.tsx               # Point d'entrée DOM
    ├── modules/                # Modules Quill personnalisés
    └── dispatch.ts             # Communication avec React Native
```

### Gestion d'état

- **Redux Store** : `state.user.bible.studies`
  - Structure des études avec métadonnées
  - Synchronisation automatique avec Firestore
  
- **Actions Redux** :
  ```typescript
  UPDATE_STUDY    // Créer ou modifier une étude
  DELETE_STUDY    // Supprimer une étude
  PUBLISH_STUDY   // Publier/dépublier une étude
  ADD_STUDIES     // Ajout en masse (sync)
  ```

- **Jotai Atoms** :
  - `openedFromTabAtom` : Tracking de l'origine de navigation

### Structure des données

```typescript
interface Study {
  id: string                      // UUID unique
  title: string                   // Titre de l'étude
  content: {                      // Format Quill Delta
    ops: DeltaOperation[]
  } | null
  created_at: number              // Timestamp de création
  modified_at: number             // Timestamp de modification
  tags?: {                        // Tags associés
    [tagId: string]: boolean
  }
  published?: boolean             // Statut de publication
  user: {                        // Informations auteur
    id: string
    displayName: string
    photoUrl?: string
  }
}
```

## Intégration Firebase

### Firestore
- Collection `studies` pour stocker les études
- Synchronisation bidirectionnelle via middleware
- Gestion optimisée du contenu (ops) et métadonnées

### Cloud Functions
- `exportStudyPDF` : Génération de PDF côté serveur
- Support des permissions Android pour le téléchargement

### Publication
- Les études publiées sont accessibles via : `https://etude.bible-strong.app/[studyId]`
- Vérification du statut HTTP pour confirmer la publication

## Utilisation

### Créer une nouvelle étude

```typescript
dispatch({
  type: 'NAVIGATE_TO_STUDY',
  payload: {
    studyId: generateUUID(),
    title: 'Nouvelle étude'
  }
})
```

### Insérer un verset dans l'éditeur

```javascript
// Via le système de dispatch StudiesDOM
dispatch({
  type: 'INSERT_AT_SELECTION',
  payload: {
    type: 'block-verse',
    verseIds: ['GEN.1.1', 'GEN.1.2'],
    version: 'LSG'
  }
})
```

### Publier une étude

```typescript
dispatch(publishStudy({
  studyId: study.id,
  isPublished: true
}))
```

## StudiesDOM - Éditeur Quill.js

Le module StudiesDOM utilise Expo DOM Components pour intégrer Quill.js :

### Communication bidirectionnelle
- **React Native → Quill** : Via `window.ReactNativeWebView.postMessage`
- **Quill → React Native** : Via injection JavaScript

### Messages supportés
- Actions de formatage (bold, italic, underline, etc.)
- Insertion de contenu (versets, strongs)
- Navigation vers la Bible
- Gestion du focus et du clavier

### Modules Quill personnalisés
- `link-verse` : Liens vers versets bibliques
- `block-verse` : Blocs de versets complets
- `link-strong` : Liens vers lexique Strong
- `block-strong` : Blocs Strong complets

## Performance et optimisations

- **Debounce** : Sauvegarde automatique après 500ms d'inactivité
- **Lazy loading** : Chargement différé du contenu des études
- **Memoization** : Optimisation du rendu des listes avec React.memo
- **Delta compression** : Format Delta de Quill pour un stockage efficace

## Points d'extension

Pour ajouter une nouvelle fonctionnalité :
1. Étendre les modules Quill dans `StudiesDOM/modules/`
2. Ajouter les actions Redux nécessaires
3. Implémenter la logique dans le middleware Firestore si besoin
4. Mettre à jour l'interface utilisateur

## Dépendances clés

- `quill` : Éditeur de texte riche
- `expo-dom-components` : Intégration DOM dans React Native
- `react-native-webview` : Container pour l'éditeur
- `@react-native-community/datetimepicker` : Sélection de dates
- Firebase (Firestore, Functions) : Backend et synchronisation