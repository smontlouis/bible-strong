import { getTabForSearchResult } from '../searchResultTab'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'

jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => 'result-tab' }))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: () => ({ Numero: 43, Nom: 'Jean', Chapitres: 21 }),
}))
jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => ({ type: 'bible', data: { selectedVersion: version } }),
}))

const note: SearchEntityResult = {
  id: 'note:1',
  title: 'Amour',
  type: 'notes',
  iconType: 'notes',
  endpoint: { type: 'note', noteId: '1' },
}

describe('open content from the palette', () => {
  it('opens the selected note rather than the note list', () => {
    expect(getTabForSearchResult(note, 'LSG')).toMatchObject({
      type: 'notes',
      title: 'Amour',
      data: { noteId: '1' },
    })
  })
  it('keeps the full canonical Strong identity', () => {
    expect(
      getTabForSearchResult(
        { ...note, endpoint: { type: 'strong', language: 'greek', code: 'G0026' } },
        'LSG'
      )
    ).toMatchObject({ type: 'strong', data: { book: 40, reference: 'G0026' } })
  })
  it('opens the returned Bible version and the complete verse range', () => {
    const result: SearchEntityResult = {
      id: 'passage:43:3:16',
      type: 'passages',
      iconType: 'passages',
      title: 'John 3:16-18',
      passage: {
        version: 'KJV',
        book: 43,
        chapter: 3,
        verse: 16,
        endChapter: 3,
        endVerse: 18,
        text: 'Love',
        highlighted: 'Love',
      },
    }
    expect(getTabForSearchResult(result, 'LSG')).toMatchObject({
      type: 'bible',
      data: {
        selectedVersion: 'KJV',
        selectedChapter: 3,
        selectedVerse: 16,
        focusVerses: [16, 17, 18],
        contextDisplayMode: 'focused',
      },
    })
  })
  it('uses the existing route opener for links', () => {
    expect(
      getTabForSearchResult(
        {
          ...note,
          endpoint: {
            type: 'externalLink',
            linkId: 'link',
            sourceKey: 'url',
            url: 'https://example.com',
          },
        },
        'LSG'
      )
    ).toBeUndefined()
  })
})
