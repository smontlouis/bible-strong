# Feature Onboarding

## Vue d'ensemble

La feature Onboarding guide les nouveaux utilisateurs à travers l'installation initiale de l'application, incluant la présentation des fonctionnalités et le téléchargement des ressources essentielles (Bibles et bases de données).

## Fonctionnalités principales

### Workflow en 3 étapes
1. **Slides de bienvenue** : Présentation des fonctionnalités clés
2. **Sélection des ressources** : Choix des Bibles et bases de données
3. **Téléchargement** : Installation des ressources sélectionnées

### Vérification automatique
- Détection de l'absence de Bible par défaut (LSG/KJV)
- Lancement automatique au premier démarrage
- Modal fullscreen non-dismissible

### Gestion des ressources
- Téléchargement de Bibles multiples
- Installation de bases de données (Strong, dictionnaire)
- Barre de progression détaillée
- Gestion des erreurs de téléchargement

## Architecture

### Structure des composants

```
onboarding/
├── OnBoarding.tsx          # Orchestrateur principal
├── OnBoardingSlides.tsx    # Slides de présentation
├── SelectResources.tsx     # Écran de sélection
├── DownloadResources.tsx   # Écran de téléchargement
└── atom.ts                # État global avec Jotai
```

### État global (Jotai)

```typescript
// atom.ts
export const selectedResourcesAtom = atom<Resource[]>([])

interface Resource {
  id: string
  name: string
  type: 'bible' | 'database'
  fileSize: number
  url: string
  required?: boolean
}
```

### Flow de données

```
OnBoarding (orchestrateur)
    ├── État: currentPage (1, 2, 3)
    ├── Contrôle de navigation
    └── Gestion du modal
        ├── OnBoardingSlides (page 1)
        ├── SelectResources (page 2)
        └── DownloadResources (page 3)
```

## Utilisation

### Déclenchement automatique

```typescript
// Dans App.tsx ou navigation root
const checkOnboarding = async () => {
  const hasDefaultBible = await checkDefaultBibleInstalled()
  
  if (!hasDefaultBible) {
    setShowOnboarding(true)
  }
}
```

### Intégration dans l'app

```typescript
// Root component
{isOnboardingVisible && (
  <OnBoarding
    onComplete={() => {
      setIsOnboardingVisible(false)
      reloadApp()
    }}
  />
)}
```

## Slides de présentation

### Configuration des slides

```typescript
const slides = [
  {
    title: "Bienvenue dans Bible Strong",
    description: "Votre compagnon pour l'étude biblique",
    image: require('./assets/slide1.png'),
    backgroundColor: '#FFB6C1'
  },
  {
    title: "Multiples versions",
    description: "Accédez à plusieurs traductions",
    image: require('./assets/slide2.png'),
    backgroundColor: '#87CEEB'
  },
  // ...
]
```

### Navigation des slides
- Swipe horizontal pour naviguer
- Indicateurs de progression
- Bouton "Suivant" pour passer à la sélection

## Sélection des ressources

### Types de ressources

```typescript
// Bibles disponibles
const bibles = [
  { id: 'LSG', name: 'Louis Segond', required: true },
  { id: 'S21', name: 'Segond 21' },
  { id: 'MARTIN', name: 'Martin' },
  // ...
]

// Bases de données
const databases = [
  { id: 'STRONG_HEBREU', name: 'Strong Hébreu' },
  { id: 'STRONG_GREC', name: 'Strong Grec' },
  { id: 'DICTIONNAIRE', name: 'Dictionnaire Westphal' },
  // ...
]
```

### Validation
- Au moins une Bible doit être sélectionnée
- LSG (FR) ou KJV (EN) obligatoire selon la langue
- Estimation de l'espace disque nécessaire

## Téléchargement

### Processus de téléchargement

```typescript
const downloadResource = async (resource: Resource) => {
  try {
    // Télécharger depuis Firebase Storage
    const response = await fetch(resource.url)
    const blob = await response.blob()
    
    // Sauvegarder localement
    await FileSystem.writeAsStringAsync(
      `${FileSystem.documentDirectory}${resource.id}.db`,
      blob
    )
    
    // Mettre à jour la progression
    updateProgress(resource.id, 100)
  } catch (error) {
    handleDownloadError(resource, error)
  }
}
```

### Gestion de la progression

```typescript
interface DownloadProgress {
  [resourceId: string]: {
    progress: number      // 0-100
    status: 'pending' | 'downloading' | 'completed' | 'error'
    error?: string
  }
}
```

### Interface utilisateur
- Barre de progression globale
- Progression individuelle par ressource
- Retry en cas d'échec
- Message de succès final

## Gestion des erreurs

### Types d'erreurs
- Erreur réseau
- Espace disque insuffisant
- Corruption de fichier
- Timeout de téléchargement

### Stratégies de récupération
```typescript
// Retry automatique
const retryDownload = async (resource: Resource, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try {
      await downloadResource(resource)
      break
    } catch (error) {
      if (i === attempts - 1) throw error
      await wait(1000 * (i + 1)) // Backoff exponentiel
    }
  }
}
```

## Configuration

### Ressources par défaut
```typescript
const DEFAULT_RESOURCES = {
  fr: ['LSG', 'STRONG_HEBREU', 'STRONG_GREC'],
  en: ['KJV', 'STRONG_HEBREW', 'STRONG_GREEK']
}
```

### URLs de téléchargement
- Stockées dans Firebase Remote Config
- Fallback vers URLs codées en dur
- Support CDN pour performances

## Performance

### Optimisations
- Téléchargements parallèles limités (max 3)
- Compression des fichiers de base de données
- Vérification d'intégrité MD5
- Reprise de téléchargement interrompu

## Points d'extension

Pour ajouter une nouvelle ressource :
1. Ajouter dans la liste des ressources disponibles
2. Configurer l'URL dans Firebase
3. Implémenter la logique d'installation spécifique
4. Mettre à jour les traductions

## Dépendances clés

- `expo-file-system` : Gestion des téléchargements
- `jotai` : État global des ressources
- `react-native-modal` : Modal fullscreen
- Firebase Storage : Hébergement des fichiers
- `@convective/react-native-reanimated-progress` : Barres de progression animées