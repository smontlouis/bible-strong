import type { Verse } from '~common/types'
import { createSpeechChapter } from '../speechChapter'

describe('createSpeechChapter', () => {
  it('builds an ordered reading queue from the verses of a chapter', () => {
    const verses = [
      { Livre: 40, Chapitre: 21, Verset: 2, Texte: 'Détachez-les.' },
      { Livre: 40, Chapitre: 21, Verset: 1, Texte: 'Ils approchèrent de Jérusalem.' },
    ] as Verse[]

    expect(createSpeechChapter(verses)).toEqual({
      verseKeys: [1, 2],
      versesByNumber: {
        1: 'Ils approchèrent de Jérusalem.',
        2: 'Détachez-les.',
      },
    })
  })

  it('returns an empty queue while the requested chapter is not ready', () => {
    expect(createSpeechChapter([])).toEqual({ verseKeys: [], versesByNumber: {} })
  })
})
