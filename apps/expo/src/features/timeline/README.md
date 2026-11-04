# Feature Timeline

## Vue d'ensemble

La chronologie biblique est une seule frise, dessinée comme sur le site public (ADR-0097) : les
treize périodes se suivent sur un axe, chacune avec sa scène, et chaque événement daté de la
publication est posé sur un couloir au-dessus de l'axe. Les vies et les grands événements sont des
cartes avec leur peinture, et un ruban sur les années qu'ils durent ; les autres sont des pastilles.
La bande des périodes, en bas, montre où l'on est et permet d'aller n'importe où. Chaque période y
garde au moins 120 points pour son numéro et son nom ; sur un téléphone la bande dépasse donc de
l'écran et glisse sous lui : toute l'histoire tient entre ses deux bords, la première période au
bord gauche, la dernière au bord droit, et la fenêtre reste sous le doigt qui glisse. Toucher une
période sans glisser mène à son début.

La langue de la ressource (`resourcesLanguage.TIMELINE`) s'applique aux événements, aux périodes et
aux repères de dates ; l'interface garde la langue de l'app. `useTimelineLanguage` centralise ce
choix et `useTimelineTranslation` lie les libellés de dates à cette langue.

## Géométrie partagée avec le site

La frise de l'app et celle du site sont calculées par le même code, dans
`@bible-strong/resource-domain` :

- `timeline-stage` : échelles et textes des périodes, axe, graduations, placement des événements sur
  des couloirs sans chevauchement, ordre des événements, et `drawTimelineEvents`, qui place les
  événements de la publication ;
- `timeline-dates` : lecture et écriture des datations de la publication.

La publication ne porte qu'une datation en mots. Les années et le type (carte ou pastille) d'un
événement viennent de `events.txt` via `timelineLayout.json`, à reconstruire après une modification
de `events.txt` :

```bash
yarn workspace @bible-strong/resource-domain timeline:layout
```

Un événement que `events.txt` ne connaît pas est placé par sa datation ; un événement daté seulement
« Future » n'a pas de place sur l'axe.

## Composants

```
timeline/
├── TimelineStageScreen       # Page : en-tête (recherche, menu) et scène
├── TimelineStage             # La scène : gestes, couches, suivi de la fiche ouverte
│   ├── TimelineStageBackdrop # Teinte et scène de chaque période, carte du nom, grande année
│   ├── TimelineStageEvents   # Cartes et pastilles proches de la vue
│   ├── TimelineStageRuler    # Axe, graduations, curseur de l'année
│   └── TimelineStageStrip    # Bande des périodes
├── timelineStageModel        # Modèle pur de la scène (testé)
├── TimelineTabScreen         # La scène dans un onglet, qui retient son année
├── TimelineResourceBoundary  # Charge les événements de la publication
├── EventScreen               # Fiche d'un événement (feuille)
├── EventDetails              # Contenu de la fiche, « Situer sur la frise », avant et après
└── TimelineSearchScreen      # Recherche locale dans la publication
```

Seuls les événements et les graduations à moins d'un écran de la vue sont dessinés ; la vue se
déplace sur le fil de l'interface (Reanimated), et React ne redessine qu'à chaque écran parcouru et
à chaque période, en basse priorité (`startTransition`). L'année du curseur et la grande année sont
écrites par le fil de l'interface (`TimelineStageYearText`), sans rendu. Le dessin de la frise
(tri et placement des 625 événements) est calculé une fois par publication, place et langue
(`getTimelineStageDrawing`), et les worklets n'emportent que des nombres, jamais le dessin.

## Navigation

- `/timeline` ouvre la frise ; `event=<slug>` l'ouvre sur un événement, `period=<id>` au début d'une
  période. `goTo`, l'index d'une période, reste lu pour les anciens liens.
- `/timeline/:language` est la route publique (ADR-0056), `/timeline-home` y redirige.
- Toucher un événement ouvre sa fiche (`/event`). Tant que la feuille reste ouverte sur la frise (sur
  iPhone, une feuille non assombrie), la frise suit l'événement qu'elle montre : précédent, suivant,
  événement associé, ou résultat de la recherche ouverte depuis la frise (`timelineStageAtoms`).
- Un onglet de chronologie retient l'année au milieu de la vue. Un onglet ouvert sur un événement
  (assistant, recherche du catalogue, « Ouvrir dans un nouvel onglet ») l'affiche dans sa feuille
  au-dessus de la frise.

## Images

- Chaque événement a sa peinture, servie par l'hôte média en 256, 768 et 1254 pixels (ADR-0096)
- `timeline-paintings/catalog.json` dit quelles peintures existent et quels documents de la publication restent à côté
- Un événement absent du catalogue garde les images de la publication
- Les 13 images de période sont embarquées dans l'app et le site : `yarn resources:timeline:paintings periods`
