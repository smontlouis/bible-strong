import type { ResourceLanguage } from '../resources/publicSite'

// Interface strings of the Timeline pages, indexed by the language of the page.
// `{name}` marks are filled in by the page.
export const TIMELINE_MESSAGES = {
  fr: {
    name: 'Chronologie biblique',
    indexHeadTitle: 'Chronologie biblique – personnages et événements de la Bible par période',
    indexHeadDescription:
      'Parcourez {events} personnages et événements de l’histoire biblique en {periods} périodes, de la Création aux prophéties de l’Apocalypse, avec leurs dates.',
    indexIntro:
      'Les personnages et les événements de l’histoire biblique dans l’ordre chronologique, de la Création aux prophéties de l’Apocalypse. Chaque événement ouvre son récit, ses dates et ses passages bibliques.',
    indexCount: '{events} événements en {periods} périodes',
    periods: 'Périodes',
    periodEvents: '{count} événements',
    otherEvents: 'Autres événements',
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
    indexIntro:
      'The people and events of biblical history in chronological order, from Creation to the prophecies of Revelation. Each event opens its account, its dates and its Bible passages.',
    indexCount: '{events} events across {periods} periods',
    periods: 'Periods',
    periodEvents: '{count} events',
    otherEvents: 'Other events',
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
