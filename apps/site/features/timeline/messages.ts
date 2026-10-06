import type { ResourceLanguage } from '../resources/publicSite'

// Interface strings of the Timeline pages, indexed by the language of the page.
// `{name}` marks are filled in by the page.
export const TIMELINE_MESSAGES = {
  fr: {
    name: 'Chronologie biblique',
    indexHeadTitle: 'Chronologie biblique – personnages et événements de la Bible par période',
    indexHeadDescription:
      'Parcourez {events} personnages et événements de l’histoire biblique en {periods} périodes, de la Création aux prophéties de l’Apocalypse, avec leurs dates.',
    periods: 'Périodes',
    canvas: 'Frise chronologique',
    canvasHint: 'Frise chronologique, à parcourir de gauche à droite',
    future: 'Futur',
    locate: 'Situer sur la frise',
    introEyebrow: 'De la Création à l’Apocalypse',
    introLead:
      '{events} personnages et événements sur une seule ligne du temps. Faites glisser pour voyager, ouvrez un événement pour le découvrir.',
    introStart: 'Commencer le voyage',
    outroTitle: 'La frise s’arrête ici',
    outroLead: 'Reprenez le voyage depuis le début, ou poursuivez dans une autre section.',
    outroRestart: 'Revenir à la Création',
    panelClose: 'Fermer',
    panelRead: 'Lire l’article complet',
    panelLoading: 'Chargement…',
    panelError: 'Impossible de charger cet événement pour le moment.',
    eventHeadTitle: '{title} ({dates}) – Chronologie biblique',
    eventFallbackDescription:
      '{title} ({dates}) dans la chronologie biblique : dates, passages bibliques et événements associés.',
    dates: 'Dates',
    article: 'En détail',
    passages: 'Passages bibliques',
    passagesVersion: 'Texte de la {version}.',
    images: 'Images',
    related: 'Événements associés',
    neighbours: 'Événements précédent et suivant',
    previous: 'Événement précédent',
    next: 'Événement suivant',
  },
  en: {
    name: 'Bible timeline',
    indexHeadTitle: 'Bible timeline – people and events of the Bible, period by period',
    indexHeadDescription:
      'Browse {events} people and events of biblical history across {periods} periods, from Creation to the prophecies of Revelation, each with its dates.',
    periods: 'Periods',
    canvas: 'Timeline',
    canvasHint: 'Timeline, travelled from left to right',
    future: 'Future',
    locate: 'Find on the timeline',
    introEyebrow: 'From Creation to Revelation',
    introLead:
      '{events} people and events on a single line of time. Drag to travel, open an event to discover it.',
    introStart: 'Start the journey',
    outroTitle: 'The timeline ends here',
    outroLead: 'Take the journey again from the start, or carry on in another section.',
    outroRestart: 'Back to Creation',
    panelClose: 'Close',
    panelRead: 'Read the full article',
    panelLoading: 'Loading…',
    panelError: 'This event could not be loaded for now.',
    eventHeadTitle: '{title} ({dates}) – Bible timeline',
    eventFallbackDescription:
      '{title} ({dates}) on the Bible timeline: dates, Bible passages and related events.',
    dates: 'Dates',
    article: 'In detail',
    passages: 'Bible passages',
    passagesVersion: 'Text of the {version}.',
    images: 'Images',
    related: 'Related events',
    neighbours: 'Previous and next events',
    previous: 'Previous event',
    next: 'Next event',
  },
} as const satisfies Record<ResourceLanguage, Record<string, string>>

export type TimelineMessages = (typeof TIMELINE_MESSAGES)[ResourceLanguage]
