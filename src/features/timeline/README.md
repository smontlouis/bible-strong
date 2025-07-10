# Feature Timeline

## Vue d'ensemble

La feature Timeline offre une chronologie biblique interactive permettant de naviguer à travers les événements historiques de la Bible. Elle présente une visualisation temporelle avec sections, sous-sections et événements détaillés.

## Fonctionnalités principales

### Navigation temporelle
- Vue d'ensemble par sections chronologiques
- Navigation fluide entre les périodes
- Barre de date interactive avec année courante
- Zoom sur des périodes spécifiques

### Types d'événements
- **Événements majeurs** : Points clés de l'histoire biblique
- **Événements mineurs** : Détails et contexte historique
- Indicateurs visuels différenciés (couleurs, tailles)
- Liens vers les passages bibliques correspondants

### Interaction
- Tap sur un événement pour voir les détails
- Swipe horizontal pour naviguer dans le temps
- Modal de détails avec description complète
- Recherche d'événements via Algolia

## Architecture

### Structure des composants

```
timeline/
├── TimelineScreen           # Navigation entre sections
├── TimelineHomeScreen       # Liste des sections disponibles
├── TimelineSection          # Vue d'une section temporelle
│   ├── Datebar             # Barre de navigation temporelle
│   ├── CurrentYear         # Indicateur année courante
│   ├── TimelineEvent       # Événement individuel
│   └── ScrollView          # Container scrollable
├── Modals/
│   ├── EventDetailsModal   # Détails d'un événement
│   └── SectionDetailsModal # Détails d'une section
└── types.ts                # Types TypeScript
```

### Structure des données

```typescript
interface Section {
  id: number
  title: TranslatedText
  subtitle: TranslatedText
  description: TranslatedText
  image: string
  color: string
  startYear: number
  endYear: number
  subSections: SubSection[]
}

interface Event {
  id: number
  title: TranslatedText
  description: TranslatedText
  startYear: number
  endYear?: number
  color: string
  type: 'major' | 'minor'
  bibleReferences?: string[]
}

interface TranslatedText {
  fr: string
  en: string
}
```

### Système de coordonnées

```typescript
// Conversion année vers position pixel
const yearToPixel = (year: number): number => {
  const ratio = (year - section.startYear) / 
                (section.endYear - section.startYear)
  return ratio * TIMELINE_WIDTH
}

// Positionnement des événements
const eventStyle = {
  left: yearToPixel(event.startYear),
  width: event.endYear 
    ? yearToPixel(event.endYear) - yearToPixel(event.startYear)
    : DEFAULT_EVENT_WIDTH
}
```

## Données

### Source
- Fichier statique `events.txt` (JSON)
- Chargé via `expo-asset`
- Structure hiérarchique : Sections → Sous-sections → Événements

### Exemple de structure
```json
{
  "sections": [{
    "id": 1,
    "title": { "fr": "Création", "en": "Creation" },
    "startYear": -4000,
    "endYear": -2000,
    "subSections": [{
      "events": [{
        "title": { "fr": "Création du monde", "en": "Creation of the world" },
        "startYear": -4000,
        "type": "major"
      }]
    }]
  }]
}
```

## Animations

### Transitions entre sections
```typescript
// Animation avec react-native-reanimated
const translateX = useSharedValue(0)

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: translateX.value }]
}))

// Navigation fluide
const navigateToSection = (index: number) => {
  translateX.value = withSpring(index * -SCREEN_WIDTH)
}
```

### Feedback visuel
- Scale animation au tap
- Fade in/out des modales
- Smooth scrolling horizontal
- Haptic feedback sur les interactions

## Utilisation

### Navigation vers la timeline
```typescript
navigation.navigate('Timeline')
```

### Affichage d'un événement
```typescript
const handleEventPress = (event: Event) => {
  setSelectedEvent(event)
  eventModalRef.current?.present()
}
```

### Navigation vers un verset
```typescript
if (event.bibleReferences) {
  dispatch({
    type: 'NAVIGATE_TO_BIBLE_VIEW',
    payload: parseReference(event.bibleReferences[0])
  })
}
```

## Personnalisation

### Thème et couleurs
- Chaque section a sa propre couleur
- Support du mode sombre
- Adaptation automatique des contrastes

### Paramètres d'affichage
- Hauteur de la timeline ajustable
- Taille des événements configurable
- Densité d'information variable

## Performance

### Optimisations
- Chargement unique des données au démarrage
- Rendu conditionnel des événements visibles
- Utilisation de `InteractionManager` pour les animations
- Mise en cache des calculs de position

## Intégrations

### Avec la recherche
- Recherche d'événements via SearchTab
- Filtrage par période ou type
- Navigation directe vers l'événement

### Avec la Bible
- Liens vers les passages bibliques
- Contexte historique pour la lecture
- Références croisées

## Points d'extension

Pour ajouter de nouveaux événements :
1. Modifier le fichier `events.txt`
2. Respecter la structure TranslatedText
3. Définir les années et le type
4. Ajouter les références bibliques

## Dépendances clés

- `react-native-reanimated` : Animations performantes
- `@gorhom/bottom-sheet` : Modales bottom sheet
- `expo-asset` : Chargement des données
- `expo-haptics` : Retour haptique
- `date-fns` : Manipulation des dates