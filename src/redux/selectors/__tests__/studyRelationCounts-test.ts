import { selectRelationCountsByEndpointIdentity } from '../bible'
import type { RootState } from '~redux/modules/reducer'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  t: (key: string) => key,
}))

const createState = (studyRelations: RootState['user']['bible']['studyRelations']) =>
  ({
    user: {
      bible: {
        studyRelations,
      },
    },
  }) as RootState

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
