import type { Verse } from '~common/types'

/** A chapter as the device's voice reads it: its verse numbers in order, and their text. */
export type SpeechChapter = {
  verseKeys: number[]
  versesByNumber: Record<number, string>
}

export const createSpeechChapter = (verses: Verse[]): SpeechChapter => {
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
