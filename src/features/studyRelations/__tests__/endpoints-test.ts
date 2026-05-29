import {
  createDictionaryEndpoint,
  createExternalLinkEndpointFromLink,
  createNaveEndpoint,
  createNoteEndpoint,
  createStrongEndpoint,
  createStudyEndpoint,
  createVerseEndpoint,
} from '../endpoints'
import { endpointIdentity } from '../domain'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
}))

describe('relation endpoint builders', () => {
  it('normalizes durable identities for user-owned endpoints', () => {
    expect(endpointIdentity(createNoteEndpoint(' note-1 ', 'Note'))).toBe('note:note-1')
    expect(endpointIdentity(createStudyEndpoint(' study-1 ', 'Étude'))).toBe('study:study-1')
  })

  it('normalizes resource endpoint identities', () => {
    expect(
      endpointIdentity(
        createStrongEndpoint({
          language: 'greek',
          code: 'G00025',
          labelFallback: 'agapao',
          originalWord: 'ἀγαπάω',
        })
      )
    ).toBe('strong:greek:25')
    expect(
      endpointIdentity(createNaveEndpoint({ nameLower: 'Amour', labelFallback: 'Amour' }))
    ).toBe('nave:fr:amour')
    expect(
      endpointIdentity(createDictionaryEndpoint({ word: 'Alliance', labelFallback: 'Alliance' }))
    ).toBe('dictionary:fr:alliance')
  })

  it('normalizes verse and external link endpoints', () => {
    expect(endpointIdentity(createVerseEndpoint(['1-1-3', '1-1-1']))).toBe('verse:1-1-1/1-1-3')
    expect(
      createExternalLinkEndpointFromLink('link-1', {
        url: 'https://example.com',
        customTitle: 'Example',
      })
    ).toMatchObject({
      type: 'externalLink',
      key: 'externalLink:link-1',
      labelFallback: 'Example',
    })
  })
})
