import {
  makeWordAnnotationsByChapterSelector,
  makeNotesForVerseSelector,
  makeStudyRelationDisplayModelsSelector,
  makeStudyRelationDisplaySectionsForStartingVerseKeySelector,
  makeStudyRelationsByChapterSelector,
  makeTaggedItemsForVerseSelector,
  makeTaggedVersesInChapterSelector,
  makeTagDataSelector,
  selectRelationCountsByEndpointIdentity,
} from '../bible'
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

  it('counts an attached note as a relation of its word annotation', () => {
    const relations: Record<string, LegacyRelation> = {
      annotationNote: {
        id: 'annotationNote',
        kind: 'system',
        endpoints: [
          { type: 'note', noteId: 'annotation:annotation-1', label: 'Ma note' },
          { type: 'verse', verseKeys: ['1-1-1'] },
        ],
        type: 'annotates',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
      manual: {
        id: 'manual',
        endpoints: [
          { type: 'annotation', annotationId: 'annotation-1', label: 'mot' },
          { type: 'study', studyId: 'study-1', label: 'Étude' },
        ],
        type: 'linked',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
    }
    const state = createState(relations)
    state.user.bible.notes = {
      'annotation:annotation-1': {
        title: 'Ma note',
        description: 'Contenu',
        date: 1,
      },
    }
    state.user.bible.wordAnnotations = {
      'annotation-1': {
        id: 'annotation-1',
        version: 'LSG',
        ranges: [{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'mot' }],
        color: 'color1',
        type: 'underline',
        date: 1,
        noteId: 'annotation:annotation-1',
      },
    }

    expect(selectRelationCountsByEndpointIdentity(state)['annotation:annotation-1']).toBe(2)
  })
})

describe('makeStudyRelationDisplayModelsSelector', () => {
  it('shows the attached note among an annotation relations', () => {
    const state = createState({
      annotationNote: {
        id: 'annotationNote',
        kind: 'system',
        endpoints: [
          { type: 'note', noteId: 'annotation:annotation-1', label: 'Ma note' },
          { type: 'verse', verseKeys: ['1-1-1'] },
        ],
        type: 'annotates',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
    })
    state.user.bible.notes = {
      'annotation:annotation-1': {
        title: 'Ma note',
        description: 'Contenu',
        date: 1,
      },
    }
    state.user.bible.wordAnnotations = {
      'annotation-1': {
        id: 'annotation-1',
        version: 'LSG',
        ranges: [{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'mot' }],
        color: 'color1',
        type: 'underline',
        date: 1,
        noteId: 'annotation:annotation-1',
      },
    }

    const models = makeStudyRelationDisplayModelsSelector()(state, {
      type: 'annotation',
      annotationId: 'annotation-1',
    })

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      activeEndpoint: { type: 'annotation', annotationId: 'annotation-1' },
      targetEndpoint: { type: 'note', noteId: 'annotation:annotation-1' },
      targetLabel: 'Ma note',
    })
  })
})

describe('annotation items anchored to Bible verses', () => {
  it('keeps annotation-only relations in the current Bible chapter', () => {
    const state = createState({
      manual: {
        id: 'manual',
        endpoints: [
          { type: 'annotation', annotationId: 'annotation-1', label: 'mot' },
          { type: 'study', studyId: 'study-1', label: 'Étude' },
        ],
        type: 'linked',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
    })
    state.user.bible.wordAnnotations = {
      'annotation-1': {
        id: 'annotation-1',
        version: 'LSG',
        ranges: [{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'mot' }],
        color: 'color1',
        type: 'underline',
        date: 1,
      },
    }

    expect(Object.keys(makeStudyRelationsByChapterSelector()(state, 1, 1, 'LSG'))).toEqual([
      'manual',
    ])
    expect(makeStudyRelationsByChapterSelector()(state, 1, 1, 'KJV')).toEqual({})
  })

  it('mixes annotation relations into the first verse relation sections', () => {
    const state = createState({
      manual: {
        id: 'manual',
        endpoints: [
          { type: 'annotation', annotationId: 'annotation-1', label: 'mot' },
          { type: 'study', studyId: 'study-1', label: 'Étude' },
        ],
        type: 'linked',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
    })
    state.user.bible.wordAnnotations = {
      'annotation-1': {
        id: 'annotation-1',
        version: 'LSG',
        ranges: [
          { verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 1, text: 'fin' },
          { verseKey: '1-1-1', startWordIndex: 2, endWordIndex: 3, text: 'début' },
        ],
        color: 'color1',
        type: 'underline',
        date: 1,
      },
    }

    const sections = makeStudyRelationDisplaySectionsForStartingVerseKeySelector()(
      state,
      '1-1-1',
      'LSG'
    )

    expect(sections).toHaveLength(1)
    expect(sections[0].data[0]).toMatchObject({
      activeEndpoint: { type: 'annotation', annotationId: 'annotation-1' },
      targetEndpoint: { type: 'study', studyId: 'study-1' },
    })
  })

  it('mixes annotation tags into the first verse tag items and count', () => {
    const state = createState({})
    state.user.bible.highlights = {
      '1-1-1': { color: 'color1', date: 1, tags: { verse: { id: 'verse', name: 'Verset' } } },
    }
    state.user.bible.wordAnnotations = {
      'annotation-1': {
        id: 'annotation-1',
        version: 'LSG',
        ranges: [
          { verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 1, text: 'fin' },
          { verseKey: '1-1-1', startWordIndex: 2, endWordIndex: 3, text: 'début' },
        ],
        color: 'color1',
        type: 'underline',
        date: 1,
        tags: { annotation: { id: 'annotation', name: 'Annotation' } },
      },
    }

    const items = makeTaggedItemsForVerseSelector()(state, '1-1-1', 'LSG')
    expect(items.map(item => item.type)).toEqual(['highlight', 'annotation'])
    expect(makeTaggedVersesInChapterSelector()(state, 1, 1, 'LSG')).toEqual({
      counts: { 1: 2 },
      hasNonHighlightTags: { 1: true },
    })
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

describe('makeWordAnnotationsByChapterSelector', () => {
  it('keeps annotation ranges addressable without sending range text to the DOM', () => {
    const selectWordAnnotationsByChapter = makeWordAnnotationsByChapterSelector()
    const state = {
      user: {
        bible: {
          wordAnnotations: {
            annotation1: {
              id: 'annotation1',
              version: 'NBS',
              color: 'color2',
              type: 'background',
              date: 1,
              ranges: [
                {
                  verseKey: '1-16-12',
                  startWordIndex: 4,
                  endWordIndex: 20,
                  text: 'âne sauvage ;\n sa main sera contre tous',
                },
              ],
            },
            annotation2: {
              id: 'annotation2',
              version: 'LSG',
              color: 'color3',
              type: 'background',
              date: 2,
              ranges: [
                {
                  verseKey: '1-16-12',
                  startWordIndex: 0,
                  endWordIndex: 2,
                  text: 'other version',
                },
              ],
            },
          },
        },
      },
    } as unknown as RootState

    const result = selectWordAnnotationsByChapter(state, 1, 16, 'NBS')

    expect(result.annotation1?.ranges[0]).toEqual({
      verseKey: '1-16-12',
      startWordIndex: 4,
      endWordIndex: 20,
      text: '',
    })
    expect(result.annotation2).toBeUndefined()
  })
})

describe('makeTagDataSelector', () => {
  it('ignores orphan note ids from the tag index', () => {
    const selectTagData = makeTagDataSelector()
    const state = {
      user: {
        bible: {
          highlights: {},
          notes: {},
          links: {},
          studies: {},
          naves: {},
          words: {},
          strongsGrec: {},
          strongsHebreu: {},
          wordAnnotations: {},
          relations: {},
        },
      },
    } as unknown as RootState

    const tag = {
      id: 'tag-1',
      name: 'Tag 1',
      notes: {
        'missing-note-1': true as const,
        'missing-note-2': true as const,
      },
    }

    expect(selectTagData(state, tag).notes).toEqual([])
  })
})
