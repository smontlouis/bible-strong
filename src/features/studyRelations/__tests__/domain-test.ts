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

jest.mock('~i18n', () => ({
  t: (key: string) => key,
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
      label: 'Genèse 1:1-2',
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

    expect(getRelationDisplayModel(relation, relation.endpoints[0])?.relationText).toBe('référence')
    expect(getRelationDisplayModel(relation, relation.endpoints[1])?.relationText).toBe(
      'référencé par'
    )
  })
})
