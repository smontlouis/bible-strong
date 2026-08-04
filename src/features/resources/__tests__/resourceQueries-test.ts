import type { ResourceAccessRegistry } from '../resourceAccess'
import { bibleChapterQueryOptions, loadBibleVerseTexts } from '../resourceQueries'

describe('resourceQueries', () => {
  it('loads a Bible chapter through the supplied Resource access registry', async () => {
    const request = { book: 1, chapter: 1, version: 'LSG' }
    const expected = {
      success: true,
      data: { kind: 'plain' as const, verses: [] },
    }
    const loadChapter = jest.fn().mockResolvedValue(expected)
    const resources = {
      bibleContent: { loadChapter },
    } as unknown as ResourceAccessRegistry

    const options = bibleChapterQueryOptions(request, resources)

    await expect(options.queryFn()).resolves.toEqual(expected)
    expect(options.queryKey).toEqual(['resource', 'bible-content', 'chapter', request])
    expect(loadChapter).toHaveBeenCalledWith(request)
    expect(options.networkMode).toBe('always')
  })

  it('loads selected verse texts through Resource access', async () => {
    const loadVerseTexts = jest.fn().mockResolvedValue({ '1-1-2': 'Two', '1-2-1': 'Three' })
    const resources = {
      bibleContent: { loadVerseTexts },
    } as unknown as ResourceAccessRegistry

    await expect(loadBibleVerseTexts(resources, 'LSG', ['1-1-2', '1-2-1'])).resolves.toEqual({
      '1-1-2': 'Two',
      '1-2-1': 'Three',
    })
    expect(loadVerseTexts).toHaveBeenCalledWith({
      version: 'LSG',
      verseKeys: ['1-1-2', '1-2-1'],
      shouldCancel: undefined,
    })
  })
})
