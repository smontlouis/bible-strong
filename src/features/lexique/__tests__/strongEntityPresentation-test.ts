import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import {
  getStrongEntityRelationPage,
  getStrongEntityAvatarKey,
  getStrongEntityPresentation,
  splitStrongEntityRelations,
} from '../strongEntityPresentation'
import {
  getGraphScenePositionIndexes,
  getOppositeGraphPositionIndex,
} from '../strongEntityGraphLayout'

const createEntity = (overrides: Partial<StrongLexiconEntity> = {}): StrongLexiconEntity => ({
  id: 1,
  uniqueName: 'Peter@Matt.4.18',
  uStrong: 'G4074G',
  strongCodes: ['G4074G'],
  name: 'Pierre',
  category: 'person',
  type: 'Male',
  description: '',
  shortDescription: '',
  summaryHtml: '',
  brief: '',
  articleHtml: '',
  matchedStrong: 'G4074G',
  relations: [],
  ...overrides,
})

describe('Strong Biblical entity presentation', () => {
  it.each([
    ['person', 'Male', 'male'],
    ['person', 'Female', 'female'],
    ['group', 'Group', 'group'],
    ['place', 'Place', 'place'],
    ['other', 'Supernatural', 'supernatural'],
    ['other', 'Time', 'time'],
    ['other', 'Musical', 'musical'],
    ['other', 'Other', 'other'],
    ['other', 'Title', 'title'],
    ['other', 'Language', 'language'],
    ['other', 'Star', 'star'],
    ['other', 'Unexpected', 'other'],
    ['unexpected', 'Female', 'other'],
  ] as const)('uses the %s/%s entity avatar', (category, type, expectedAvatar) => {
    expect(getStrongEntityAvatarKey(category, type)).toBe(expectedAvatar)
  })

  it.each([
    ['person', 'person', 'user'],
    ['place', 'place', 'map-pin'],
    ['group', 'group', 'users'],
    ['other', 'other', 'bookmark'],
    ['unexpected', 'other', 'bookmark'],
  ] as const)('maps %s entities to the %s presentation', (category, kind, icon) => {
    expect(getStrongEntityPresentation(createEntity({ category }))).toEqual({
      kind,
      icon,
      showsRelationshipGraph: kind === 'person' || kind === 'place' || kind === 'group',
    })
  })

  it('keeps every prioritized personal relation in the paginated graph', () => {
    const relations = [
      'resident',
      'offspring',
      'sibling',
      'mother',
      'partner',
      'father',
      'founder_or_origin',
      'sibling',
    ].map((relation, index) => ({
      relation,
      certainty: 'asserted',
      targetName: `Target ${index}`,
    }))

    const result = splitStrongEntityRelations(createEntity({ relations }))

    expect(result.graph.map(item => item.relation)).toEqual([
      'father',
      'mother',
      'partner',
      'sibling',
      'sibling',
      'offspring',
      'resident',
      'founder_or_origin',
    ])
    expect(result.remaining).toEqual([])
  })

  it('uses the relationship graph for places', () => {
    const relations = [{ relation: 'resident', certainty: 'asserted', targetName: 'Pierre' }]

    expect(splitStrongEntityRelations(createEntity({ category: 'place', relations }))).toEqual({
      graph: relations,
      remaining: [],
    })
  })

  it('uses the relationship graph for groups', () => {
    const relations = [
      { relation: 'father', certainty: 'asserted', targetName: 'Canaan' },
      { relation: 'sibling', certainty: 'asserted', targetName: 'Héthiens' },
      { relation: 'resident', certainty: 'asserted', targetName: 'Amoréens' },
    ]

    expect(splitStrongEntityRelations(createEntity({ category: 'group', relations }))).toEqual({
      graph: relations,
      remaining: [],
    })
  })

  it('paginates six relations at the root and reserves one slot for the previous entity', () => {
    const relations = Array.from({ length: 13 }, (_, index) => ({
      relation: 'offspring',
      certainty: 'asserted',
      targetUniqueName: `Target-${index + 1}`,
      targetName: `Target ${index + 1}`,
    }))

    expect(getStrongEntityRelationPage(relations, undefined, 1)).toMatchObject({
      pageIndex: 1,
      pageCount: 3,
      relations: relations.slice(6, 12),
    })
    expect(getStrongEntityRelationPage(relations, 'Previous', 1)).toMatchObject({
      pageIndex: 1,
      pageCount: 3,
      relations: relations.slice(5, 10),
    })
  })

  it('removes the previous entity from regular relations and clamps an outdated page', () => {
    const relations = [
      {
        relation: 'father',
        certainty: 'asserted',
        targetUniqueName: 'Adam',
        targetName: 'Adam',
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        relation: 'sibling',
        certainty: 'asserted',
        targetUniqueName: `Sibling-${index + 1}`,
        targetName: `Sibling ${index + 1}`,
      })),
    ]

    const result = getStrongEntityRelationPage(relations, 'Adam', 99)

    expect(result.pageIndex).toBe(1)
    expect(result.pageCount).toBe(2)
    expect(result.relations.map(relation => relation.targetName)).toEqual(['Sibling 6'])
  })

  it('maps every graph position to the opposite position on the same axis', () => {
    expect([0, 1, 2, 3, 4, 5].map(getOppositeGraphPositionIndex)).toEqual([5, 4, 3, 2, 1, 0])
  })

  it('reserves the position opposite the relation used to enter a scene', () => {
    expect(getGraphScenePositionIndexes(2)).toEqual({
      previousPositionIndex: 3,
      relationPositionIndexes: [1, 5, 2, 4, 0],
    })
    expect(getGraphScenePositionIndexes()).toEqual({
      previousPositionIndex: undefined,
      relationPositionIndexes: [3, 1, 5, 2, 4, 0],
    })
  })
})
