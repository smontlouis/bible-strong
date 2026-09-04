import type { Verse } from '~common/types'
import type { StrongLexiconMorphology } from '~features/resources/strongLexiconAccess'

export const getStrongContextVerseText = (verse: Verse): string => verse.Texte

const lowerFirst = (value: string): string =>
  value ? `${value[0].toLocaleLowerCase()}${value.slice(1)}` : value

export const formatStrongContextMorphology = (
  morphology: Pick<StrongLexiconMorphology, 'code' | 'meaning'>
): string => `${lowerFirst(morphology.meaning)} · ${morphology.code}`
