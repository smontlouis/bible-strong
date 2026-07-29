import { DomUtils, parseDocument } from 'htmlparser2'

import type { Verse } from '~common/types'
import type {
  StrongLexiconEntry,
  StrongLexiconMorphology,
} from '~features/resources/strongLexiconAccess'
import { parseStrongVerse } from '~helpers/strongVerseParser'

export const getStrongContextVerseText = (
  verse: Verse,
  entry: Pick<StrongLexiconEntry, 'baseCode' | 'gloss'>,
  clickedWord?: string
): string => {
  const source = DomUtils.textContent(parseDocument(verse.Texte))
  return parseStrongVerse(source, Number(verse.Livre), [
    { Code: entry.baseCode, LSG: clickedWord || entry.gloss },
  ])
    .visibleText.replace(/\s+/gu, ' ')
    .trim()
}

const lowerFirst = (value: string): string =>
  value ? `${value[0].toLocaleLowerCase()}${value.slice(1)}` : value

export const formatStrongContextMorphology = (
  morphology: Pick<StrongLexiconMorphology, 'code' | 'meaning'>
): string => `${lowerFirst(morphology.meaning)} · ${morphology.code}`
