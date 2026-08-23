import { newStemmer } from 'snowball-stemmers'

import {
  highlightBibleSearchTextByNormalizedTerms,
  normalizeBibleSearchText,
} from '../../../src/helpers/bibleSearchInput'

export type BibleSearchStemLanguage = 'fr' | 'en'

const frenchStemmer = newStemmer('french')
const englishStemmer = newStemmer('english')

export const stemBibleSearchText = (value: string, language: BibleSearchStemLanguage): string => {
  const stemmer = language === 'fr' ? frenchStemmer : englishStemmer
  return normalizeBibleSearchText(value)
    .split(' ')
    .filter(Boolean)
    .map(term => stemmer.stem(term))
    .join(' ')
}

export const highlightStemmedBibleSearchText = (
  text: string,
  rawQuery: string,
  language: BibleSearchStemLanguage
) =>
  highlightBibleSearchTextByNormalizedTerms(text, rawQuery, term =>
    stemBibleSearchText(term, language)
  )
