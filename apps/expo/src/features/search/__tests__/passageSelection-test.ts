import {
  createPassageSelectionTarget,
  resolvePassageTarget,
  isSelectableVersePassage,
  getPassageSelectionRange,
  isVerseInSelectionRange,
} from '../passageSelection'
import type { SearchEntityResult } from '../shared/searchResultTypes'

jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: (keys: string[]) => keys.join(', '),
}))

const item: SearchEntityResult = {
  id: 'range',
  type: 'passages',
  iconType: 'passages',
  title: 'John',
  passage: {
    book: 43,
    chapter: 3,
    verse: 35,
    endChapter: 4,
    endVerse: 2,
    version: 'NBS',
    text: '',
    highlighted: '',
  },
}

it('keeps the result version and both ends of a cross-chapter semantic passage', () => {
  const range = getPassageSelectionRange(item, 'LSG')!
  expect(range).toEqual({
    book: 43,
    chapter: 3,
    endChapter: 4,
    startVerse: 35,
    endVerse: 2,
    version: 'NBS',
  })
  const verse = (chapter: number, number: number) => ({
    Livre: 43,
    Chapitre: chapter,
    Verset: number,
    Texte: '',
  })
  expect(isVerseInSelectionRange(verse(3, 34), range)).toBe(false)
  expect(isVerseInSelectionRange(verse(3, 35), range)).toBe(true)
  expect(isVerseInSelectionRange(verse(4, 2), range)).toBe(true)
  expect(isVerseInSelectionRange(verse(4, 3), range)).toBe(false)
})

it('inserts precisely the checked verses, in biblical order and in the chosen version', () => {
  const target = createPassageSelectionTarget(['43-4-2', '43-3-35', '43-4-2'], 'NBS')
  expect(target.endpoint).toEqual(
    expect.objectContaining({ type: 'verse', version: 'NBS', verseKeys: ['43-3-35', '43-4-2'] })
  )
})

it('rejects a whole chapter in both results and insertion', async () => {
  const chapter: SearchEntityResult = {
    id: 'chapter',
    type: 'passages',
    iconType: 'passages',
    title: 'Gen 3',
    referenceSegment: { book: 1, chapter: 3, startVerse: 1, endVerse: 24, isWholeChapter: true },
  }
  const loadChapter = jest.fn()
  expect(isSelectableVersePassage(chapter)).toBe(false)
  await expect(resolvePassageTarget(chapter, 'LSG', loadChapter)).rejects.toThrow(
    'Choose explicit verses'
  )
  expect(loadChapter).not.toHaveBeenCalled()
})

it('inserts a clicked verse immediately without loading the chapter', async () => {
  const loadChapter = jest.fn()
  const result = await resolvePassageTarget(
    {
      ...item,
      passage: {
        ...item.passage!,
        chapter: 11,
        verse: 35,
        endChapter: undefined,
        endVerse: undefined,
      },
    },
    'LSG',
    loadChapter
  )
  expect(result.endpoint).toEqual(
    expect.objectContaining({ verseKeys: ['43-11-35'], version: 'NBS' })
  )
  expect(loadChapter).not.toHaveBeenCalled()
})

it('keeps only the clicked range across chapters', async () => {
  const loadChapter = jest.fn(async ({ chapter }: { chapter: number }) => ({
    success: true as const,
    data: {
      presentation: 'canonical' as const,
      kind: 'plain' as const,
      verses: (chapter === 3 ? [34, 35, 36] : [1, 2, 3]).map(Verset => ({
        Livre: 43,
        Chapitre: chapter,
        Verset,
        Texte: 'text',
      })),
    },
  }))
  const result = await resolvePassageTarget(item, 'LSG', loadChapter)
  expect(result.endpoint).toEqual(
    expect.objectContaining({
      verseKeys: ['43-3-35', '43-3-36', '43-4-1', '43-4-2'],
      version: 'NBS',
    })
  )
})
