import type { Verse } from '~common/types'

export type TtsChapterData = {
  verseKeys: number[]
  versesByNumber: Record<number, string>
}

export const createTtsChapterData = (verses: Verse[]): TtsChapterData => {
  const versesByNumber: Record<number, string> = {}
  for (const verse of verses) {
    versesByNumber[Number(verse.Verset)] = verse.Texte
  }

  return {
    verseKeys: Object.keys(versesByNumber)
      .map(Number)
      .sort((left, right) => left - right),
    versesByNumber,
  }
}
