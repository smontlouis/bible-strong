import type { Verse } from '~common/types'
import { createTtsChapterData } from '../ttsChapterData'

describe('createTtsChapterData', () => {
  it('builds an ordered TTS queue from the chapter already loaded by the reader', () => {
    const verses = [
      { Livre: 40, Chapitre: 21, Verset: 2, Texte: 'Détachez-les.' },
      { Livre: 40, Chapitre: 21, Verset: 1, Texte: 'Ils approchèrent de Jérusalem.' },
    ] as Verse[]

    expect(createTtsChapterData(verses)).toEqual({
      verseKeys: [1, 2],
      versesByNumber: {
        1: 'Ils approchèrent de Jérusalem.',
        2: 'Détachez-les.',
      },
    })
  })

  it('returns an empty queue while the requested chapter is not ready', () => {
    expect(createTtsChapterData([])).toEqual({ verseKeys: [], versesByNumber: {} })
  })
})
