import { makeNotesForVerseSelector, selectRelationCountsByEndpointIdentity } from '../bible'
import type { RootState } from '~redux/modules/reducer'
import {
  normalizeRelation,
  rebuildRelationIndexes,
  type LegacyRelation,
  type RelationsObj,
} from '~features/studyRelations/domain'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

const createState = (legacyRelations: Record<string, LegacyRelation>) => {
  const relations = Object.values(legacyRelations).reduce(
    (result, relation) => ({
      ...result,
      [relation.id]: normalizeRelation(relation),
    }),
    {} as RelationsObj
  )
  return {
    user: {
      bible: {
        relations,
        relationIndex: rebuildRelationIndexes(relations),
      },
    },
  } as unknown as RootState
}

describe('selectRelationCountsByEndpointIdentity', () => {
  it('counts relations from both endpoints', () => {
    const counts = selectRelationCountsByEndpointIdentity(
      createState({
        relation1: {
          id: 'relation1',
          endpoints: [
            { type: 'note', noteId: 'note-1', label: 'Note' },
            { type: 'study', studyId: 'study-1', label: 'Étude' },
          ],
          type: 'linked',
          direction: 'none',
          createdAt: 1,
          updatedAt: 1,
        },
      })
    )

    expect(counts['note:note-1']).toBe(1)
    expect(counts['study:study-1']).toBe(1)
  })

  it('counts verse ranges by exact endpoint identity', () => {
    const counts = selectRelationCountsByEndpointIdentity(
      createState({
        relation1: {
          id: 'relation1',
          endpoints: [
            { type: 'verse', verseKeys: ['1-1-2', '1-1-3'], label: 'Genèse 1:2-3' },
            { type: 'note', noteId: 'note-1', label: 'Note' },
          ],
          type: 'linked',
          direction: 'none',
          createdAt: 1,
          updatedAt: 1,
        },
      })
    )

    expect(counts['verse:1-1-2/1-1-3']).toBe(1)
    expect(counts['verse:1-1-2']).toBeUndefined()
    expect(counts['verse:1-1-3']).toBeUndefined()
  })
})

describe('makeNotesForVerseSelector', () => {
  it('returns every note related to the selected verse, including range notes', () => {
    const selectNotesForVerse = makeNotesForVerseSelector()
    const state = createState({
      singleVerseNote: {
        id: 'system:annotates:note-1',
        kind: 'system',
        endpoints: [
          { type: 'note', noteId: 'note-1', label: 'Note 1' },
          { type: 'verse', verseKeys: ['1-1-1'], label: 'Genèse 1:1' },
        ],
        type: 'annotates',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
      rangeNote: {
        id: 'system:annotates:note-2',
        kind: 'system',
        endpoints: [
          { type: 'note', noteId: 'note-2', label: 'Note 2' },
          { type: 'verse', verseKeys: ['1-1-1', '1-1-2', '1-1-3'], label: 'Genèse 1:1-3' },
        ],
        type: 'annotates',
        direction: 'none',
        createdAt: 2,
        updatedAt: 2,
      },
    }) as RootState

    state.user.bible.notes = {
      'note-1': { id: 'note-1', title: 'Note 1', description: 'Genèse 1:1', date: 1 },
      'note-2': { id: 'note-2', title: 'Note 2', description: 'Genèse 1:1-3', date: 2 },
    }
    state.user.bible.wordAnnotations = {}

    expect(selectNotesForVerse(state, '1-1-1').map(note => note.id)).toEqual(['note-2', 'note-1'])
  })
})
