import {
  getBibleViewParamsForSearchResult,
  getOpenableAction,
  getOpenableActionForRelationEndpoint,
} from '../openableStudyObjects'
import {
  createExternalLinkEndpoint,
  createNoteEndpoint,
  createStrongEndpoint,
  createVerseEndpoint,
} from '../endpoints'

jest.mock('~assets/bible_versions/books-desc', () =>
  Array.from({ length: 51 }, (_, index) =>
    index === 0
      ? { Numero: 1, Nom: 'Genèse', Chapitres: 50 }
      : index === 50
        ? { Numero: 51, Nom: 'Colossiens', Chapitres: 4 }
        : { Numero: index + 1, Nom: `Book ${index + 1}`, Chapitres: 1 }
  )
)

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
}))

describe('openable study objects', () => {
  it('preserves Bible version context for passage search results', () => {
    expect(
      getBibleViewParamsForSearchResult({
        book: 51,
        chapter: 2,
        verse: 19,
        version: 'DBY',
      })
    ).toEqual({
      contextDisplayMode: 'focused',
      book: JSON.stringify({ Numero: 51, Nom: 'Colossiens', Chapitres: 4 }),
      chapter: '2',
      verse: '19',
      version: 'DBY',
      focusVerses: JSON.stringify([19]),
    })
  })

  it('opens passage search results through the shared Interface', () => {
    expect(
      getOpenableAction({
        id: 'passage:DBY:51:2:19',
        type: 'passages',
        iconType: 'passages',
        title: 'Colossiens 2:19',
        passage: {
          book: 51,
          chapter: 2,
          verse: 19,
          version: 'DBY',
          highlighted: '...',
          text: '...',
        },
      })
    ).toEqual({
      type: 'route',
      pathname: '/bible-view',
      params: getBibleViewParamsForSearchResult({
        book: 51,
        chapter: 2,
        verse: 19,
        version: 'DBY',
      }),
    })
  })

  it('opens Verse endpoints without version-specific text identity', () => {
    expect(getOpenableActionForRelationEndpoint(createVerseEndpoint(['1-1-1', '1-1-2']))).toEqual({
      type: 'route',
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 1, Nom: 'Genèse', Chapitres: 50 }),
        chapter: '1',
        verse: '1',
        focusVerses: JSON.stringify([1, 2]),
      },
    })
  })

  it('preserves a preferred version when opening a Verse endpoint', () => {
    const endpoint = createVerseEndpoint(['1-1-1'], undefined, 'VUL')

    expect(getOpenableActionForRelationEndpoint(endpoint)).toEqual({
      type: 'route',
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 1, Nom: 'Genèse', Chapitres: 50 }),
        chapter: '1',
        verse: '1',
        focusVerses: JSON.stringify([1]),
        version: 'VUL',
      },
    })
  })

  it('opens Note and Strong endpoints through descriptors', () => {
    expect(getOpenableActionForRelationEndpoint(createNoteEndpoint('note-1'))).toEqual({
      type: 'note',
      noteId: 'note-1',
    })
    expect(
      getOpenableActionForRelationEndpoint(createStrongEndpoint({ language: 'greek', code: 'G25' }))
    ).toEqual({
      type: 'route',
      pathname: '/strong',
      params: {
        book: '40',
        reference: '25',
      },
    })
  })

  it('surfaces unavailable external Links as a toast action', () => {
    expect(
      getOpenableActionForRelationEndpoint(
        createExternalLinkEndpoint({ linkId: '', url: '', labelFallback: '' })
      )
    ).toEqual({ type: 'toast', messageKey: 'Lien introuvable' })
  })
})
