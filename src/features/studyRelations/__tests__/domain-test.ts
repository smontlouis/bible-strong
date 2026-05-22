import {
  endpointIdentity,
  getRelationDisplayModel,
  getRelationDuplicateKey,
  normalizeStudyRelation,
  normalizeVerseKeys,
  type StudyRelation,
} from '../domain'

jest.mock('~assets/bible_versions/books-desc', () => [
  { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  { Numero: 2, Nom: 'Exode', Chapitres: 40 },
])

const translations: Record<string, string> = {
  'studyRelations.type.linked': 'lié à',
  'studyRelations.type.references': 'renvoie vers',
  'studyRelations.type.explains': 'explique',
  'studyRelations.type.contrasts': 'contraste avec',
  'studyRelations.type.referencedBy': 'référencé par',
  'studyRelations.type.explainedBy': 'expliqué par',
}

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: Record<string, unknown>) =>
      options?.bookNumber ? `Livre ${options.bookNumber}` : translations[key] || key,
  },
  t: (key: string) => translations[key] || key,
}))

describe('study relation domain', () => {
  it('normalizes verse keys in canonical order', () => {
    expect(normalizeVerseKeys(['1-1-3', '1-1-1', '1-1-2', '1-1-2'])).toEqual([
      '1-1-1',
      '1-1-2',
      '1-1-3',
    ])
  })

  it('normalizes linked relations to no direction', () => {
    const relation = normalizeStudyRelation({
      id: 'r1',
      endpoints: [
        { type: 'verse', verseKeys: ['1-1-2', '1-1-1'] },
        { type: 'verse', verseKeys: ['1-2-1'] },
      ],
      type: 'linked',
      direction: 'forward',
      createdAt: 1,
      updatedAt: 1,
    })

    expect(relation.direction).toBe('none')
    expect(relation.endpoints[0]).toEqual({
      type: 'verse',
      verseKeys: ['1-1-1', '1-1-2'],
    })
  })

  it('builds duplicate keys from unordered endpoints and relation type', () => {
    const left = { type: 'verse' as const, verseKeys: ['1-1-1'] }
    const right = { type: 'verse' as const, verseKeys: ['1-1-2'] }

    expect(getRelationDuplicateKey([left, right], 'linked')).toBe(
      getRelationDuplicateKey([right, left], 'linked')
    )
    expect(endpointIdentity(left)).toBe('verse:1-1-1')
  })

  it('uses active and passive wording for directional relations', () => {
    const relation: StudyRelation = {
      id: 'r1',
      endpoints: [
        { type: 'verse', verseKeys: ['1-1-1'], label: 'Genèse 1:1' },
        { type: 'verse', verseKeys: ['1-1-2'], label: 'Genèse 1:2' },
      ],
      type: 'references',
      direction: 'forward',
      createdAt: 1,
      updatedAt: 1,
    }

    expect(getRelationDisplayModel(relation, relation.endpoints[0])?.relationText).toBe(
      'renvoie vers'
    )
    expect(getRelationDisplayModel(relation, relation.endpoints[1])?.relationText).toBe(
      'référencé par'
    )
  })

  it('keeps missing note and study endpoints visible with fallback labels', () => {
    const relation: StudyRelation = {
      id: 'r1',
      endpoints: [
        { type: 'note', noteId: 'missing-note', label: 'Ancienne note' },
        { type: 'study', studyId: 'missing-study', label: 'Ancienne étude' },
      ],
      type: 'linked',
      direction: 'none',
      createdAt: 1,
      updatedAt: 1,
    }

    const model = getRelationDisplayModel(relation, relation.endpoints[0], {
      notes: {},
      studies: {},
    })

    expect(model).toMatchObject({
      targetLabel: 'Ancienne étude',
      isTargetAvailable: false,
      subtitle: 'Étude indisponible',
    })
  })

  it('resolves available endpoint labels from current user data', () => {
    const relation: StudyRelation = {
      id: 'r1',
      endpoints: [
        { type: 'note', noteId: 'note-1', label: 'Fallback note' },
        { type: 'study', studyId: 'study-1', label: 'Fallback study' },
      ],
      type: 'linked',
      direction: 'none',
      createdAt: 1,
      updatedAt: 1,
    }

    const model = getRelationDisplayModel(relation, relation.endpoints[0], {
      notes: { 'note-1': { title: 'Note actuelle', description: '', date: 1 } },
      studies: {
        'study-1': {
          id: 'study-1',
          title: 'Étude actuelle',
          created_at: 1,
          modified_at: 1,
          content: null,
          user: { id: 'user', displayName: 'User', photoUrl: '' },
        },
      },
    })

    expect(model?.targetLabel).toBe('Étude actuelle')
    expect(model?.isTargetAvailable).toBe(true)
  })

  it('supports Nave and dictionary endpoints as relation targets', () => {
    const relation: StudyRelation = {
      id: 'r1',
      endpoints: [
        { type: 'nave', nameLower: 'amour', label: 'Amour' },
        { type: 'dictionary', word: 'Alliance', label: 'Alliance' },
      ],
      type: 'linked',
      direction: 'none',
      createdAt: 1,
      updatedAt: 1,
    }

    const model = getRelationDisplayModel(relation, relation.endpoints[0], {
      naves: { amour: { title: 'Amour' } },
      words: { Alliance: { title: 'Alliance biblique' } },
    })

    expect(endpointIdentity(relation.endpoints[0])).toBe('nave:amour')
    expect(endpointIdentity(relation.endpoints[1])).toBe('dictionary:Alliance')
    expect(model?.targetLabel).toBe('Alliance biblique')
    expect(model?.subtitle).toBe('Dictionnaire')
  })
})
