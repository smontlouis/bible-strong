import { makeSelectBookmarkForChapter, makeSelectBookmarksInChapter } from '../bookmarks'
import type { Bookmark } from '~common/types'

const bookmark = (verse: unknown): Bookmark => ({
  id: 'chapter',
  name: 'Lecture',
  color: '#cc0000',
  book: 1,
  chapter: 8,
  date: 1,
  // Reproduce historical synced data outside the current type contract.
  verse: verse as Bookmark['verse'],
})

it.each([undefined, null, { _methodName: 'deleteField' }, { _type: 'delete' }])(
  'recognizes legacy chapter bookmarks consistently: %j',
  verse => {
    const item = bookmark(verse)
    expect(makeSelectBookmarkForChapter().resultFunc({ chapter: item }, 1, 8)).toBe(item)
    expect(makeSelectBookmarksInChapter().resultFunc({ chapter: item }, 1, 8)).toEqual({})
  }
)

it('keeps verse-specific bookmarks out of the chapter indicator', () => {
  const item = bookmark('5')
  expect(makeSelectBookmarkForChapter().resultFunc({ chapter: item }, 1, 8)).toBeUndefined()
  expect(makeSelectBookmarksInChapter().resultFunc({ chapter: item }, 1, 8)).toEqual({ 5: item })
  expect(
    makeSelectBookmarkForChapter().resultFunc({ chapter: bookmark(undefined) }, 1, 9)
  ).toBeUndefined()
})
