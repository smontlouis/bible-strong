# Feature Snackbar

## Vue d'ensemble

La feature Snackbar fournit un système de notifications temporaires pour afficher des messages d'information, d'erreur ou de confirmation à l'utilisateur. Elle est utilisée à travers toute l'application pour communiquer des états et des actions.

## Fonctionnalités principales

### Types de notifications
- **Info** : Messages d'information généraux (couleur grise)
- **Danger** : Messages d'erreur ou d'avertissement (couleur rouge)
- Support des messages personnalisés avec actions

### Options d'affichage
- Position configurable (top ou bottom)
- Durée d'affichage personnalisable
- Actions optionnelles (confirm/cancel)
- Animation fluide d'entrée/sortie
- Gestion de file d'attente pour messages multiples

## Architecture

### Structure des composants

```
snackbar/
├── SnackBar.tsx        # Composant React Native principal
├── SnackBarManager.js  # Gestionnaire de file d'attente
└── index.ts           # API publique simplifiée
```

### API publique

```typescript
// Structure d'appel
Snackbar.show(
  message: string,
  type?: 'info' | 'danger',
  options?: {
    position?: 'top' | 'bottom'
    duration?: number
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
  }
)
```

## Utilisation

### Messages simples

```typescript
import Snackbar from '~common/SnackBar'

// Message d'information
Snackbar.show('Verset copié dans le presse-papiers')

// Message d'erreur
Snackbar.show('Erreur de connexion', 'danger')

// Message avec position
Snackbar.show('Téléchargement terminé', 'info', {
  position: 'top'
})
```

### Messages avec actions

```typescript
Snackbar.show('Supprimer cette note ?', 'danger', {
  confirmText: 'Supprimer',
  cancelText: 'Annuler',
  onConfirm: () => deleteNote(),
  onCancel: () => console.log('Annulé')
})
```

### Configuration personnalisée

```typescript
// Message avec durée personnalisée
Snackbar.show('Message long', 'info', {
  duration: 10000 // 10 secondes
})

// Message permanent (jusqu'à action)
Snackbar.show('Action requise', 'danger', {
  duration: 0,
  confirmText: 'OK'
})
```

## Mécanisme interne

### Gestion de la file d'attente

```javascript
// SnackBarManager gère les messages multiples
class SnackBarManager {
  queue = []
  currentSnackBar = null
  
  push(message) {
    this.queue.push(message)
    this.processQueue()
  }
  
  processQueue() {
    if (!this.currentSnackBar && this.queue.length > 0) {
      this.showNext()
    }
  }
}
```

### Animations

```typescript
// Animation d'entrée
Animated.parallel([
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true
  }),
  Animated.timing(translateY, {
    toValue: 0,
    duration: 200,
    useNativeDriver: true
  })
]).start()
```

### Root Siblings

Utilise `react-native-root-siblings` pour afficher au-dessus de tout :
```typescript
const sibling = new RootSiblings(
  <SnackBar {...props} />
)
```

## Styles et personnalisation

### Couleurs par type
```typescript
const backgroundColors = {
  info: colors.lightGrey,
  danger: colors.quart
}

const textColors = {
  info: colors.default,
  danger: colors.white
}
```

### Positionnement
```typescript
const positions = {
  top: { top: 50 },
  bottom: { bottom: 50 }
}
```

## Intégrations dans l'app

### Cas d'usage courants
- Confirmation de copie dans le presse-papiers
- Erreurs de téléchargement
- Confirmation d'actions (suppression, sauvegarde)
- Messages de succès
- Avertissements de connexion

### Exemples d'utilisation
```typescript
// Dans Bible feature
Snackbar.show('Verset surligné')

// Dans Settings
Snackbar.show('Paramètres sauvegardés')

// Dans Studies
Snackbar.show('Étude publiée avec succès')

// Gestion d'erreur
catch (error) {
  Snackbar.show(error.message, 'danger')
}
```

## Performance

### Optimisations
- Une seule instance active à la fois
- Destruction automatique après utilisation
- Animations optimisées avec `useNativeDriver`
- File d'attente efficace pour messages multiples

## Configuration globale

### Valeurs par défaut
- Durée : 5000ms (5 secondes)
- Position : bottom
- Type : info
- Animation : 200ms

### Personnalisation possible
Pour modifier les valeurs par défaut, éditer `SnackBar.tsx` :
```typescript
static defaultProps = {
  duration: 5000,
  position: 'bottom',
  type: 'info'
}
```

## Dépendances

- `react-native-root-siblings` : Affichage au-dessus de l'interface
- API `Animated` de React Native : Animations
- Pas de dépendances externes lourdes

## Points d'attention

- Ne pas afficher de messages trop longs
- Éviter les messages en cascade rapide
- Toujours fournir un feedback pour les actions importantes
- Utiliser le type approprié pour le contexte