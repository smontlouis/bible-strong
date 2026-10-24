import {
  countWords,
  getDayMinutes,
  getTextSize,
  loadPassageSize,
  readingMinutes,
} from '../planReadingTime'

jest.mock('~features/resources/resourceAccess', () => ({ defaultResourceAccess: {} }))
jest.mock('~state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: () => 'LSG' }))

const access = {
  bibleContent: {
    loadChapter: jest.fn(async ({ chapter }: { chapter: number }) => ({
      success: true,
      data: {
        verses: [
          { Verset: 1, Texte: `Premier verset du chapitre ${chapter}` },
          { Verset: 2, Texte: 'Et un <i>second</i>' },
        ],
      },
    })),
    loadVerseTexts: jest.fn(async () => ({ '23-30-18': 'C’est pourquoi l’Éternel attend' })),
  },
}

it('counts words without markup and rounds minutes up', () => {
  expect(countWords(' Au  commencement, <i>Dieu</i> créa ')).toBe(4)
  expect(countWords('')).toBe(0)
  expect(readingMinutes(1)).toBe(1)
  expect(readingMinutes(401)).toBe(3)
})

it('weighs a text and opens it on its first line', () => {
  expect(getTextSize('\n\nPremière ligne\nDeuxième ligne')).toEqual({
    words: 4,
    opening: 'Première ligne',
  })
})

it('loads the verses of chapters and of a verse range in the version', async () => {
  const chapters = await loadPassageSize(
    { type: 'Chapter', id: 'c', chapters: '1|4-5' },
    'LSG',
    access as never
  )
  expect(access.bibleContent.loadChapter).toHaveBeenCalledTimes(2)
  expect(chapters).toEqual({ verses: 4, words: 16, opening: 'Premier verset du chapitre 4' })
  const verses = await loadPassageSize(
    { type: 'Verse', verses: '23|30:18-19' },
    'LSG',
    access as never
  )
  expect(access.bibleContent.loadVerseTexts).toHaveBeenCalledWith({
    version: 'LSG',
    verseKeys: ['23-30-18', '23-30-19'],
  })
  expect(verses).toEqual({ verses: 1, words: 4, opening: 'C’est pourquoi l’Éternel attend' })
  expect(
    await loadPassageSize({ type: 'Chapter', id: 'c', chapters: 'nope' }, 'LSG', access as never)
  ).toBeNull()
})

it('sums the minutes shown on the elements of a day', () => {
  expect(getDayMinutes({ a: { words: 150 }, b: { words: 450 }, c: { words: 0 } })).toBe(4)
})
