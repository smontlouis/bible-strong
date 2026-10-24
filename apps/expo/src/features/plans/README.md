# Feature Plans

## Vue d'ensemble

La feature Plans permet aux utilisateurs de suivre des plans de lecture biblique et de méditation structurés. Elle offre un système de progression complet, du contenu multimédia enrichi et une synchronisation cross-platform.

## Fonctionnalités principales

### Filtres de découverte

Le header des Plans de lecture utilise `FiltersHeader` avec recherche et langue.
Les paramètres de `/plans` sont la source des filtres : `language=fr|en|all` et
`search=<texte>`. Sans langue explicite (ou avec une valeur invalide), la langue
actuelle de l'utilisateur est sélectionnée. Les modifications du panneau utilisent
`router.setParams`, sans état local de filtre ni listener de focus.

Les filtres s'appliquent uniquement à « À découvrir ». « Vos plans » reste visible
indépendamment de la recherche et de la langue. Choisir une autre langue ou « Tout »
est une action explicite ; Réinitialiser revient à la langue utilisateur et vide
la recherche. Le retour depuis un détail conserve les paramètres de l'écran ; une
nouvelle entrée sans paramètres reprend les valeurs par défaut.

Le catalogue des recueils (`/daily-reading`) applique le même paramètre `language`
et le même défaut utilisateur. Son filtre et sa réinitialisation mettent à jour
les paramètres de navigation ; le choix du verset du jour reste toujours visible.

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

### Le jour courant, la série et « Continuer »

`planSchedule.ts` lit un plan suivi contre son calendrier, pour la page du plan, la liste et
l'accueil :

- le **jour courant** est celui du calendrier, aujourd'hui, même si des jours plus anciens
  restent à lire ; avant la date de départ c'est le jour 1, et une fois le calendrier fini
  ou sans calendrier (ancienne progression), le premier jour non lu ;
- un jour est **lu**, **manqué** (passé et non lu), **aujourd'hui** ou **à venir** : la bande
  des jours et le calendrier du mois le montrent, et « N lectures à retrouver » mène au
  premier jour manqué ;
- la **série** compte les jours du calendrier lus d'affilée jusqu'à aujourd'hui, ou jusqu'à
  hier tant que la lecture du jour reste à faire ; rattraper des jours manqués la prolonge,
  et elle s'éteint le lendemain du dernier jour ;
- **« Continuer »** mène au jour courant, puis, une fois lu, au premier jour manqué
  (« Rattraper »). Sur l'accueil et dans la liste, la pastille ouvre `/plan?continue=1` : la
  page du plan ouvre aussitôt l'élément par-dessus elle, si bien que le retour montre le
  plan, où la journée terminée est fêtée.

La durée d'un élément (`planReadingTime.ts`) se compte en mots, à 200 mots par minute :
ceux du passage dans la version par défaut, ou ceux du texte. Une vidéo ou une image n'en a
pas. La ligne d'un élément montre aussi son début, dans la police de lecture.

Sous le jour viennent les trois jours **à venir** et, sur mobile, le **rappel quotidien**. À
partir de 800 points de large, la progression, le calendrier du mois, les jours à venir et le
rappel passent dans une colonne à droite du jour.

La liste des plans range les plans suivis en « Vos parcours » et « Terminés » (avec
« Recommencer »), et ne montre dans « À découvrir » que les plans pas encore suivis.

### Éléments d'un jour

Un jour de plan n'a pas de page à lui. La page du plan liste les éléments du jour
sélectionné, chacun avec une case lu / non lu et un chevron :

- un **passage** (`Chapter`, `Verse`) ouvre le lecteur Bible en **mode plan** : l'en-tête
  reste celui d'un chapitre, mais le livre n'y est plus un sélecteur, et la navigation
  entre chapitres reste dans le passage. Un bandeau « Plan — Genèse 1-3 » sous l'en-tête
  nomme le passage ; sa croix quitte le mode plan et rend le lecteur libre. Pour des
  versets, une icône y bascule entre les versets et le chapitre entier ;
- un **texte**, une **image** ou une **vidéo** ouvre sa propre page (`/plan-entity`) ;
- un **titre** sert d'intertitre dans la liste.

Les pages d'un élément et le lecteur Bible vivent dans la même pile, celle de la feuille
Explore (`app/(explore)/`) : sur iOS, les éléments d'un jour s'ouvrent tous dans la même
feuille ; sur le Web large, dans le panneau de droite.

Chaque élément se termine par « Voir la suite », qui ouvre l'élément suivant du jour à sa
place, dans la même feuille, quel que soit son type : revenir en arrière ramène toujours à
la page du plan. Dans le lecteur Bible, la
carte attend le dernier chapitre du passage. Le dernier élément propose « Terminer la
journée », qui marque le jour comme lu et revient au plan, où il est fêté.

Ouvrir un élément le marque comme lu ; la case permet de le faire à la main. Le jour est
terminé quand tous ses éléments sont lus, et redevient non terminé si l'un d'eux est
décoché. Marquer le jour entier, comme lu ou non lu, s'applique à tous ses éléments.

La progression par élément est dans `OngoingPlan.entitySlices` (identifiants des éléments
lus, par jour non terminé). Le statut du jour dans `readingSlices` reste la référence : un
jour `Completed` vaut tous ses éléments lus, donc la progression antérieure est intacte.

L'ancienne route d'un jour (`/plan-slice`) ouvre la page du plan sur ce jour.

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
│   ├── PlanScreen            # Détail d'un plan, jour par jour
│   ├── PlanEntityScreen      # Page d'un texte, d'une image ou d'une vidéo
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

### Ajouter un plan

```typescript
await dispatch(fetchPlan(planId))
```

### Marquer une lecture comme complétée

```typescript
// Un jour entier (bascule lu / non lu)
dispatch(markAsRead({ planId: plan.id, readingSliceId: readingSlice.id }))

// Un élément du jour
dispatch(markEntitySliceAsRead({ planId, readingSliceId, entitySliceId }))
dispatch(markEntitySliceAsUnread({ planId, readingSliceId, entitySliceId }))
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
