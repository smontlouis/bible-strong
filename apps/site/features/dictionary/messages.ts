import type { ResourceLanguage } from '../resources/publicSite'

// Interface strings of the dictionary pages, in the language of the dictionary being read.
const MESSAGES = {
  fr: {
    'index.title': 'Dictionnaires bibliques',
    'index.intro':
      'Personnes, lieux, coutumes et notions de la Bible, expliqués par les dictionnaires bibliques de référence. Choisissez un ouvrage, puis parcourez ses articles par lettre.',
    'work.letters': 'Parcourir par lettre',
    'work.about': 'À propos de cet ouvrage',
    'work.edition': 'Édition',
    'work.source': 'Source',
    'work.attribution': 'Attribution',
    'letter.count': '{count} articles',
    'letter.count.one': '1 article',
    'letter.range': 'Articles {first} à {last}',
    'entry.neighbours': 'Articles voisins',
    'entry.previous': 'Article précédent',
    'entry.next': 'Article suivant',
    'entry.letter': 'Tous les articles en {letter}',
    'entry.related': 'Dans d’autres dictionnaires',
    'entry.source': 'Source de l’article',
  },
  en: {
    'index.title': 'Bible dictionaries',
    'index.intro':
      'People, places, customs and notions of the Bible, explained by reference Bible dictionaries. Choose a work, then browse its articles by letter.',
    'work.letters': 'Browse by letter',
    'work.about': 'About this work',
    'work.edition': 'Edition',
    'work.source': 'Source',
    'work.attribution': 'Attribution',
    'letter.count': '{count} articles',
    'letter.count.one': '1 article',
    'letter.range': 'Articles {first} to {last}',
    'entry.neighbours': 'Neighbouring articles',
    'entry.previous': 'Previous article',
    'entry.next': 'Next article',
    'entry.letter': 'All articles in {letter}',
    'entry.related': 'In other dictionaries',
    'entry.source': 'Source of the article',
  },
} as const

export type DictionaryMessageKey = keyof (typeof MESSAGES)['en']

export const dictionaryMessages =
  (language: ResourceLanguage) =>
  (key: DictionaryMessageKey): string =>
    MESSAGES[language][key]
