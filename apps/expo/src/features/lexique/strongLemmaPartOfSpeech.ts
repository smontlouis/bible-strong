type SupportedLocale = 'en' | 'fr'

type PartOfSpeech =
  | 'adjective'
  | 'adverb'
  | 'article'
  | 'conjunction'
  | 'determiner'
  | 'foreignWord'
  | 'interjection'
  | 'negation'
  | 'noun'
  | 'numeral'
  | 'particle'
  | 'preposition'
  | 'presentative'
  | 'pronoun'
  | 'properNoun'
  | 'punctuation'
  | 'verb'

const PART_OF_SPEECH_BY_SOURCE_VALUE: Record<string, PartOfSpeech> = {
  adj: 'adjective',
  adv: 'adverb',
  conj: 'conjunction',
  det: 'determiner',
  intj: 'interjection',
  name: 'properNoun',
  noun: 'noun',
  num: 'numeral',
  particle: 'particle',
  prep: 'preposition',
  pron: 'pronoun',
  verb: 'verb',

  A: 'article',
  E: 'negation',
  F: 'numeral',
  G: 'foreignWord',
  H: 'foreignWord',
  J: 'determiner',
  N: 'properNoun',
  O: 'pronoun',
  P: 'pronoun',
  Q: 'pronoun',
  X: 'verb',
  a: 'article',
  c: 'conjunction',
  d: 'adverb',
  e: 'negation',
  f: 'determiner',
  g: 'determiner',
  j: 'adjective',
  n: 'noun',
  o: 'interjection',
  p: 'pronoun',
  q: 'pronoun',
  r: 'pronoun',
  v: 'verb',
  x: 'verb',
  y: 'verb',
  '°': 'punctuation',
  Ë: 'determiner',
  Ï: 'interjection',
  â: 'verb',
  ç: 'conjunction',
  é: 'preposition',
  ê: 'verb',
  ë: 'verb',
  ï: 'presentative',
  ž: 'pronoun',
}

const LABELS: Record<SupportedLocale, Record<PartOfSpeech, string>> = {
  en: {
    adjective: 'adj',
    adverb: 'adv',
    article: 'art',
    conjunction: 'conj',
    determiner: 'det',
    foreignWord: 'foreign',
    interjection: 'intj',
    negation: 'neg',
    noun: 'n',
    numeral: 'num',
    particle: 'part',
    preposition: 'prep',
    presentative: 'pres',
    pronoun: 'pron',
    properNoun: 'N',
    punctuation: 'punct',
    verb: 'v',
  },
  fr: {
    adjective: 'adj',
    adverb: 'adv',
    article: 'art',
    conjunction: 'conj',
    determiner: 'dét',
    foreignWord: 'étr',
    interjection: 'interj',
    negation: 'nég',
    noun: 'n',
    numeral: 'num',
    particle: 'part',
    preposition: 'prép',
    presentative: 'prés',
    pronoun: 'pron',
    properNoun: 'N',
    punctuation: 'ponct',
    verb: 'v',
  },
}

export const formatStrongLemmaPartOfSpeech = (sourceValue: string, locale: string): string => {
  const normalizedSourceValue = sourceValue.trim()
  if (!normalizedSourceValue) return ''

  const partOfSpeech = PART_OF_SPEECH_BY_SOURCE_VALUE[normalizedSourceValue]
  const supportedLocale: SupportedLocale = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const label = partOfSpeech ? LABELS[supportedLocale][partOfSpeech] : normalizedSourceValue

  return `[${label}]`
}
