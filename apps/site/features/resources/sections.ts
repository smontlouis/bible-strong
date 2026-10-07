import type { ResourceLanguage } from './publicSite'

export type ResourceSectionKey =
  | 'bible'
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'commentary'
  | 'timeline'

export type ResourceSection = {
  key: ResourceSectionKey
  label: Record<ResourceLanguage, string>
  /** What a reader finds there, for menus and hubs. */
  summary: Record<ResourceLanguage, string>
  /** The entry page of the section in a language. */
  path: (language: ResourceLanguage) => string
}

/** The public resource families of the site, in the order they are offered. */
export const RESOURCE_SECTIONS: readonly ResourceSection[] = [
  {
    key: 'bible',
    label: { fr: 'Bible', en: 'Bible' },
    summary: {
      fr: 'Lire la Bible dans plus de 40 versions',
      en: 'Read the Bible in more than 40 versions',
    },
    // The Bible entry has no resource language of its own: it follows the site locale.
    path: language => (language === 'fr' ? '/fr/bible' : '/bible'),
  },
  {
    key: 'strong',
    label: { fr: 'Lexique', en: 'Lexicon' },
    summary: {
      fr: 'Les mots hébreux et grecs et leurs numéros Strong',
      en: 'Hebrew and Greek words and their Strong’s numbers',
    },
    path: language => `/strong/${language}`,
  },
  {
    key: 'dictionary',
    label: { fr: 'Dictionnaire', en: 'Dictionary' },
    summary: {
      fr: 'Personnes, lieux et notions bibliques',
      en: 'Biblical people, places and notions',
    },
    path: language => `/dictionary/${language}`,
  },
  {
    key: 'nave',
    label: { fr: 'Thèmes', en: 'Topics' },
    summary: {
      fr: 'La Bible par thèmes, d’après Nave',
      en: 'The Bible by topic, after Nave',
    },
    path: language => `/nave/${language}`,
  },
  {
    key: 'commentary',
    label: { fr: 'Commentaires', en: 'Commentaries' },
    summary: {
      fr: 'Les commentaires bibliques, chapitre par chapitre',
      en: 'Bible commentaries, chapter by chapter',
    },
    path: language => `/commentary/${language}`,
  },
  {
    key: 'timeline',
    label: { fr: 'Chronologie', en: 'Timeline' },
    summary: {
      fr: 'Les événements de l’histoire biblique',
      en: 'The events of biblical history',
    },
    path: language => `/timeline/${language}`,
  },
]

export const resourceSection = (key: ResourceSectionKey): ResourceSection => {
  const section = RESOURCE_SECTIONS.find(candidate => candidate.key === key)
  if (!section) throw new Error(`RESOURCE_SECTION_UNKNOWN:${key}`)
  return section
}
