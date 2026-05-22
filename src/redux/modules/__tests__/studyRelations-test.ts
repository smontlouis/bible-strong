import userReducer, { Link, UserState } from '../user'
import {
  addStudyRelationAction,
  deleteStudyRelation,
  updateStudyRelation,
  type StudyRelation,
} from '../user/studyRelations'

jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
}))

jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))
jest.mock('expo-sqlite', () => ({}))
jest.mock('~helpers/bibleVersions', () => ({
  versions: {},
  getIfVersionNeedsUpdate: jest.fn(),
}))
jest.mock('~helpers/databases', () => ({
  databases: {},
  getIfDatabaseNeedsUpdate: jest.fn(),
}))
jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))
jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({ set: jest.fn() })),
}))
jest.mock('~helpers/firebase', () => ({
  firebaseDb: { collection: jest.fn() },
}))
jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: jest.fn(() => 'fr'),
  t: (key: string) => key,
}))
jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))
jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

const initialState = userReducer(undefined, { type: '@@INIT' }) as UserState

const createRelation = (overrides: Partial<StudyRelation> = {}): StudyRelation => ({
  id: 'relation-1',
  endpoints: [
    { type: 'verse', verseKeys: ['1-1-1'] },
    { type: 'verse', verseKeys: ['1-1-2'] },
  ],
  type: 'linked',
  direction: 'none',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('study relation reducer', () => {
  it('adds a normalized study relation', () => {
    const state = userReducer(initialState, addStudyRelationAction(createRelation()))

    expect(state.bible.studyRelations['relation-1'].endpoints[0]).toEqual({
      type: 'verse',
      verseKeys: ['1-1-1'],
    })
  })

  it('prevents duplicate relation edges for the same unordered pair and type', () => {
    const state = userReducer(initialState, addStudyRelationAction(createRelation()))
    const duplicate = createRelation({
      id: 'relation-2',
      endpoints: [createRelation().endpoints[1], createRelation().endpoints[0]],
    })
    const nextState = userReducer(state, addStudyRelationAction(duplicate))

    expect(Object.keys(nextState.bible.studyRelations)).toEqual(['relation-1'])
  })

  it('updates type and valid direction together', () => {
    const state = userReducer(initialState, addStudyRelationAction(createRelation()))
    const nextState = userReducer(
      state,
      updateStudyRelation({
        id: 'relation-1',
        changes: { type: 'references', direction: 'forward', label: 'Allusion' },
      })
    )

    expect(nextState.bible.studyRelations['relation-1']).toMatchObject({
      type: 'references',
      direction: 'forward',
      label: 'Allusion',
    })
  })

  it('deletes a study relation without deleting endpoints', () => {
    const state = userReducer(initialState, addStudyRelationAction(createRelation()))
    const nextState = userReducer(state, deleteStudyRelation('relation-1'))

    expect(nextState.bible.studyRelations).toEqual({})
  })

  it('keeps external links and tags separate from study relations', () => {
    const link: Link = {
      url: 'https://example.com',
      linkType: 'website',
      date: 1,
      tags: { tag1: { id: 'tag1', name: 'Theme' } },
    }
    const state: UserState = {
      ...initialState,
      bible: {
        ...initialState.bible,
        links: { '1-1-1': link },
        notes: { note1: { title: 'Note', description: 'Body', date: 1 } },
        tags: {
          tag1: {
            id: 'tag1',
            name: 'Theme',
            date: 1,
            links: { '1-1-1': true },
          },
        },
      },
    }

    const withRelation = userReducer(state, addStudyRelationAction(createRelation()))
    const withoutRelation = userReducer(withRelation, deleteStudyRelation('relation-1'))

    expect(withoutRelation.bible.links).toEqual(state.bible.links)
    expect(withoutRelation.bible.notes).toEqual(state.bible.notes)
    expect(withoutRelation.bible.tags).toEqual(state.bible.tags)
  })
})
