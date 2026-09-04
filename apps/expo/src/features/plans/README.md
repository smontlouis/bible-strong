# Feature Plans

## Vue d'ensemble

La feature Plans permet aux utilisateurs de suivre des plans de lecture biblique et de méditation structurés. Elle offre un système de progression complet, du contenu multimédia enrichi et une synchronisation cross-platform.

## Fonctionnalités principales

### Types de plans
- **Plans annuels** (`yearly`) : Lecture complète de la Bible sur une année
- **Plans de méditation** (`meditation`) : Études thématiques courtes
- Support multilingue (Français/Anglais)
- Plans gratuits et premium

### Système de progression
- **Statuts de lecture** :
  - `Idle` : Non commencé
  - `Next` : Prochain élément à lire
  - `Progress` : En cours (un seul plan à la fois)
  - `Completed` : Terminé
- Marquage automatique de progression
- Calcul du pourcentage d'avancement
- Possibilité de réinitialiser un plan

### Types de contenu
- **Chapitres bibliques** : Livres entiers ou sections
- **Versets spécifiques** : Passages ciblés
- **Textes de méditation** : Réflexions et enseignements
- **Images** : Illustrations et infographies
- **Vidéos** : Contenu YouTube intégré

## Architecture

### Structure des composants

```
plans/
├── Screens/
│   ├── MyPlanListScreen      # Liste des plans de l'utilisateur
│   ├── ExploreScreen         # Découverte de nouveaux plans
│   ├── PlanScreen            # Détail d'un plan avec sections
│   ├── PlanSliceScreen       # Lecture immersive d'une tranche
│   └── PlanSelectScreen      # Sélection d'un plan
├── Components/
│   ├── Slice                 # Composant abstrait de rendu
│   ├── ChapterSlice          # Rendu des chapitres
│   ├── VerseSlice            # Rendu des versets
│   ├── TextSlice             # Rendu du texte
│   ├── ImageSlice            # Rendu des images
│   └── VideoSlice            # Rendu des vidéos
├── UI/
│   ├── PlanSectionList       # Liste des sections expandables
│   ├── ReadingSlice          # Item de lecture avec statut
│   ├── SuccessModal          # Modal de félicitations
│   └── ParamsModal           # Paramètres de mise en forme
└── Home/
    └── PlanHome              # Widget pour l'écran d'accueil
```

### Structure des données

```typescript
interface Plan {
  id: string                  // Identifiant unique
  title: string               // Titre du plan
  subTitle?: string           // Sous-titre optionnel
  image?: string              // URL de l'image de couverture
  author: {                   // Informations sur l'auteur
    id: string
    displayName: string
    photoUrl?: string
  }
  type: 'yearly' | 'meditation'  // Type de plan
  lang: 'fr' | 'en'             // Langue du plan
  sections: Section[]            // Sections du plan
}

interface Section {
  id: string                  // ID de la section
  title: string               // Titre de la section
  readingSlices: ReadingSlice[] // Tranches de lecture
}

interface ReadingSlice {
  id: string                  // ID de la tranche
  title?: string              // Titre optionnel
  slices: EntitySlice[]       // Contenu de la tranche
}

interface EntitySlice {
  type: 'Title' | 'Text' | 'Verse' | 'Chapter' | 'Video' | 'Image'
  title?: string              // Pour les titres
  text?: string               // Pour le texte
  viewMore?: string           // Lien "voir plus"
  subType?: string            // Sous-type (ex: 'quote')
}
```

### Gestion d'état Redux

```typescript
interface PlanState {
  myPlans: Plan[]             // Plans téléchargés localement
  onlinePlans: {              // Plans disponibles en ligne
    data: PlanSummary[]
    isFetching: boolean
  }
  ongoingPlans: OngoingPlan[] // Progression utilisateur
  images: Record<string, string> // Cache des URLs d'images
}
```

## Utilisation

### Explorer et ajouter un plan

```typescript
// Navigation vers l'exploration
navigation.navigate('ExploreScreen')

// Ajouter un plan
await dispatch(fetchPlan(planId))
```

### Marquer une lecture comme complétée

```typescript
dispatch(markAsRead({
  planId: plan.id,
  sectionId: section.id,
  readingSliceId: readingSlice.id,
  status: 'Completed'
}))
```

### Réinitialiser un plan

```typescript
dispatch(resetPlan(plan.id))
```

### Format des références bibliques

```
// Versets : "livre|chapitre:verset_début-verset_fin"
"1|1:1-3"     // Genèse 1:1-3

// Chapitres : "livre|chapitre_début-chapitre_fin"
"1|1-3"       // Genèse chapitres 1 à 3
```

## Intégrations

### Avec la feature Bible
- Chargement des versets via `biblesDb` (SQLite)
- Navigation vers la lecture complète
- Support du changement de version biblique
- Récupération des titres de sections (péricopes)

### Avec Firebase
- Stockage des plans dans Firestore
- Synchronisation de la progression
- Hébergement des images sur Firebase Storage
- Analytics des événements de lecture

### Avec la navigation
- Paramètres typés entre écrans
- Support du deep linking
- Gestion du back button
- Intégration avec les tabs

## Algorithmes clés

### Calcul de progression

```javascript
// Progression d'une section
const sectionProgress = completedSlices / totalSlices

// Progression globale d'un plan
const totalProgress = sections.reduce((acc, section) => {
  return acc + (sectionProgress(section) * section.weight)
}, 0) / sections.length
```

### Détermination du prochain élément

```javascript
// Trouve le premier élément non complété
const nextSlice = readingSlices.find(slice => 
  !ongoingSlices.find(o => 
    o.id === slice.id && o.status === 'Completed'
  )
)
```

## Performance

- **Lazy loading** : Chargement différé des plans
- **Cache d'images** : URLs stockées localement
- **Optimisation des listes** : Utilisation de FlashList
- **Debounce** : Sur les actions de marquage

## Personnalisation

### Paramètres de lecture
- Taille de police ajustable
- Espacement des lignes
- Mode sombre/clair
- Police par défaut ou personnalisée

### Widget d'accueil
- Affichage du plan en cours
- Indicateur de progression circulaire
- Accès rapide à la prochaine lecture

## Points d'extension

Pour ajouter un nouveau type de contenu :
1. Créer un nouveau composant dans `Components/`
2. Ajouter le type dans `EntitySlice`
3. Implémenter le rendu dans `Slice.tsx`
4. Gérer l'import/export si nécessaire

## Dépendances clés

- `@reduxjs/toolkit` : Gestion d'état
- `react-native-webview` : Vidéos YouTube
- `expo-image` : Affichage optimisé des images
- `react-native-reanimated` : Animations fluides
- Firebase : Backend et synchronisation