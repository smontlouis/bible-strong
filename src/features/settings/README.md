# Feature Settings

## Vue d'ensemble

La feature Settings centralise tous les paramètres et configurations de l'application Bible Strong. Elle gère les préférences utilisateur, les téléchargements de contenu, la personnalisation visuelle, l'authentification et l'import/export de données.

## Fonctionnalités principales

### Gestion du compte
- Connexion/Inscription avec email ou Google
- Synchronisation des données avec Firebase
- Suppression de compte avec confirmation
- Profil utilisateur avec photo et nom

### Téléchargements
- Gestion des bases de données bibliques
- Téléchargement de nouvelles versions
- Mise à jour des bases existantes
- Indicateur de progression et taille des fichiers

### Personnalisation
- **Couleurs de surlignage** : 5 couleurs personnalisables
- **Tags/Étiquettes** : Création et gestion de catégories
- **Thèmes** : Support clair/sombre
- **Options de partage** : Format des versets partagés

### Import/Export
- Sauvegarde complète des données utilisateur
- Import depuis un fichier JSON
- Export vers le système de fichiers
- Conservation des highlights, notes, études, etc.

### Support et informations
- FAQ (Foire aux questions)
- Journal des modifications (Changelog)
- Contact développeur
- Liens vers les réseaux sociaux

## Architecture

### Structure des composants

```
settings/
├── Screens/
│   ├── MoreScreen              # Menu principal des paramètres
│   ├── DownloadsScreen         # Gestion des téléchargements
│   ├── HighlightsScreen        # Liste des surlignages
│   ├── CustomHighlightColorsScreen # Personnalisation couleurs de surlignage
│   ├── TagsScreen              # Gestion des tags
│   ├── TagScreen               # Détail d'un tag
│   ├── ImportExportScreen      # Import/Export données
│   ├── LoginScreen             # Connexion
│   ├── RegisterScreen          # Inscription
│   ├── BibleShareOptionsScreen # Options de partage
│   ├── ChangelogScreen         # Journal des modifications
│   ├── FAQScreen               # Questions fréquentes
│   └── SupportScreen           # Page de support
├── Components/
│   ├── SettingItem             # Élément de menu
│   ├── ColorPicker             # Sélecteur de couleur
│   ├── TagItem                 # Élément de tag
│   └── DownloadItem            # Élément téléchargeable
└── Modals/
    ├── DeleteAccountModal      # Confirmation suppression
    └── TagEditModal            # Édition de tag
```

### Structure des données

```typescript
// Configuration des couleurs
interface HighlightColors {
  color1: string  // #FFF59D
  color2: string  // #A5D6A7
  color3: string  // #F8BBD0
  color4: string  // #69D2E7
  color5: string  // #DCDCDC
}

// Structure d'un tag
interface Tag {
  id: string
  name: string
  highlights?: Record<string, boolean>
  notes?: Record<string, boolean>
  studies?: Record<string, boolean>
  strongsHebreu?: Record<string, boolean>
  strongsGrec?: Record<string, boolean>
  words?: Record<string, boolean>
  naves?: Record<string, boolean>
}

// Options de partage
interface ShareOptions {
  verseNumbers: boolean
  reference: 'inline' | 'bottom'
  version: boolean
}

// Données exportables
interface ExportData {
  highlights: Record<string, Highlight>
  notes: Record<string, Note>
  studies: Study[]
  tags: Record<string, Tag>
  settings: UserSettings
  colors: HighlightColors
}
```

## Téléchargements

### Bases de données disponibles
- Versions bibliques (LSG, Martin, Darby, etc.)
- Lexiques Strong (Hébreu, Grec)
- Dictionnaire Westphal
- Concordance Nave
- Commentaires bibliques

### Processus de téléchargement
```typescript
// Télécharger une base
await downloadDatabase({
  id: 'LSG',
  url: 'https://...',
  size: 15000000,
  onProgress: (progress) => updateProgress(progress)
})

// Vérifier les mises à jour
const updates = await checkDatabaseUpdates()
```

## Gestion des tags

### Opérations CRUD
```typescript
// Créer un tag
dispatch(createTag({
  name: 'Promesses',
  color: '#69D2E7'
}))

// Associer à du contenu
dispatch(addTagToHighlight({
  tagId: 'tag-123',
  highlightId: 'GEN.1.1'
}))

// Filtrer par tag
const filtered = highlights.filter(h => 
  h.tags && h.tags[selectedTagId]
)
```

### Organisation
- Tags globaux pour tout le contenu
- Filtrage multi-critères
- Statistiques d'utilisation
- Fusion et suppression de tags

## Import/Export

### Export de données
```typescript
const exportData = async () => {
  const data = {
    version: APP_VERSION,
    exportDate: Date.now(),
    highlights: state.highlights,
    notes: state.notes,
    studies: state.studies,
    tags: state.tags,
    settings: state.settings
  }
  
  await FileSystem.writeAsStringAsync(
    `${FileSystem.documentDirectory}bible-strong-backup.json`,
    JSON.stringify(data)
  )
}
```

### Import de données
```typescript
const importData = async (fileUri: string) => {
  const content = await FileSystem.readAsStringAsync(fileUri)
  const data = JSON.parse(content)
  
  // Validation et merge
  dispatch(importUserData(data))
}
```

## Authentification

### Méthodes supportées
- Email/Mot de passe
- Google Sign-In
- Apple Sign-In (iOS)
- Mode anonyme/local

### Synchronisation Firebase
```typescript
// Connexion
await signInWithEmailAndPassword(auth, email, password)

// Sync automatique via middleware
firestoreMiddleware.syncUserData()
```

## Personnalisation visuelle

### Modification des couleurs
```typescript
// Changer une couleur
dispatch(updateHighlightColor({
  colorKey: 'color1',
  newColor: '#FF5722'
}))

// Prévisualisation en temps réel
<ColorPicker
  currentColor={colors.color1}
  onChange={(color) => setTempColor(color)}
  onConfirm={(color) => saveColor(color)}
/>
```

### Thèmes
- Adaptation automatique au mode système
- Override manuel possible
- Couleurs ajustées pour la lisibilité

## Points d'intégration

### Redux Store
- Module `user` pour toutes les données
- Actions synchrones et asynchrones
- Middleware pour Firebase sync

### Navigation
- Intégration avec React Navigation
- Deep linking pour certains écrans
- Modales et bottom sheets

### Permissions
- Accès fichiers pour import/export
- Notifications push (si activées)
- Accès réseau pour téléchargements

## Performance

### Optimisations
- Lazy loading des écrans secondaires
- Pagination des listes longues (highlights)
- Cache des données téléchargées
- Compression des exports

## Configuration

### Variables d'environnement
```
FIREBASE_API_KEY
GOOGLE_SIGNIN_WEB_CLIENT_ID
SENTRY_DSN
```

### Remote Config
- `apple_reviewing` : Mode review Apple
- `download_urls` : URLs des bases de données
- `feature_flags` : Activation de features

## Dépendances clés

- `@react-native-firebase/*` : Services Firebase
- `@react-native-google-signin/google-signin` : Auth Google
- `expo-file-system` : Gestion fichiers
- `@gorhom/bottom-sheet` : Bottom sheets
- `react-native-color-picker` : Sélection couleurs