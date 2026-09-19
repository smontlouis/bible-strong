import {
  commentaryContext,
  commentaryCollectionContext,
  dictionaryContext,
  naveContext,
  pickReadingContext,
} from '../resourceContext'
import { loadConversations, saveConversations, type ReadingContext } from '../conversations'
jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
  __esModule: true,
  default: { t: (key: string) => key },
}))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: ({
    bookNum,
    chapterNum,
    verses,
  }: {
    bookNum: number
    chapterNum: number
    verses?: number[]
  }) => `${bookNum}:${chapterNum}${verses?.length ? ':' + verses.join(',') : ''}`,
}))
describe('assistant resource context', () => {
  it('identifies a commentary author, resource, section and passage without claiming to have read its text', () => {
    const c = commentaryContext(
      { projectionId: 'acbc:fr', book: 43, chapter: 15, sectionId: 'section-4' },
      { id: 'section-4', rangeStartVerse: 4, rangeEndVerse: 5 }
    )!
    expect(c.kind).toBe('commentary')
    expect(c.label).toContain('Adam Clarke')
    expect(c.label).toContain('43:15:4,5')
    expect(c.detail).toContain('resourceId=acbc')
    expect(c.detail).toContain('sectionId=section-4')
    expect(c.detail).toContain('Texte non fourni')
    expect(c.activeContext).toEqual({
      kind: 'commentary',
      resourceId: 'acbc',
      language: 'fr',
      book: 43,
      chapter: 15,
      startVerse: 4,
      endVerse: 5,
      sectionId: 'section-4',
    })
    expect(commentaryContext({ projectionId: 'unknown:fr', book: 43, chapter: 15 })).toBeNull()
  })
  it('keeps a multi-author list distinct from one selected commentary', () => {
    const value = commentaryCollectionContext('43-15-4', ['acbc:fr', 'barnes:fr'])!
    expect(value.label).toContain('43:15:4')
    expect(value.detail).toContain('Adam Clarke')
    expect(value.detail).toContain('Albert Barnes')
    expect(value.detail).toContain('Aucun auteur unique')
    expect(commentaryCollectionContext('bad')).toBeNull()
    expect(commentaryContext({ projectionId: 'acbc:fr', book: 99, chapter: 1 })).toBeNull()
  })
  it('distinguishes dictionary sources and Nave languages', () => {
    const a = dictionaryContext({ word: 'Berger', work: 'bost', entryId: 17, language: 'fr' })!
    const b = dictionaryContext({ word: 'Berger', work: 'westphal', entryId: 17, language: 'fr' })!
    expect(a.key).not.toBe(b.key)
    expect(a.detail).toContain('entryId=17')
    expect(a.activeContext).toMatchObject({ kind: 'dictionary', work: 'bost', entryId: 17 })
    expect(
      naveContext({ name: 'Patience', name_lower: 'patience', language: 'en' })?.detail
    ).toContain('langue=en')
    expect(dictionaryContext({})).toBeNull()
    expect(naveContext({})).toBeNull()
  })
  it('defaults to a newly opened panel, follows interactions and returns to the reader on close', () => {
    const reader: ReadingContext = { key: 'b', label: 'Bible', detail: 'Bible', kind: 'passage' }
    const panel: ReadingContext = {
      key: 'c',
      label: 'Clarke',
      detail: 'Clarke',
      kind: 'commentary',
    }
    const options = { reader, panel, location: 'route1', panelOpen: true }
    expect(pickReadingContext({ ...options, interaction: null })).toBe(panel)
    expect(
      pickReadingContext({ ...options, interaction: { location: 'route1', surface: 'reader' } })
    ).toBe(reader)
    expect(
      pickReadingContext({ ...options, interaction: { location: 'route1', surface: 'panel' } })
    ).toBe(panel)
    expect(
      pickReadingContext({
        ...options,
        location: 'route2',
        interaction: { location: 'route1', surface: 'reader' },
      })
    ).toBe(panel)
    expect(
      pickReadingContext({
        ...options,
        panelOpen: false,
        interaction: { location: 'route1', surface: 'panel' },
      })
    ).toBe(reader)
    expect(pickReadingContext({ ...options, panel: null, interaction: null })).toBeNull()
  })
  it('persists new resource kinds and bounds provider context', () => {
    const context = dictionaryContext({
      word: 'a'.repeat(400),
      dictionaryTitle: 'b'.repeat(400),
      work: 'bost',
    })!
    expect(context.detail.length).toBeLessThanOrEqual(500)
    let raw = ''
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value
      },
      removeItem: () => {},
    }
    saveConversations(storage, 'account', [
      {
        id: 'c',
        title: 'q',
        updatedAt: 1,
        messages: [{ id: 'u', role: 'user', text: 'q', state: 'complete', createdAt: 1, context }],
      },
    ])
    expect(loadConversations(storage, 'account')[0].messages[0].context?.kind).toBe('dictionary')
  })
})
