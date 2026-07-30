import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import {
  getStrongEntityAvatarKey,
  getStrongEntityPresentation,
  splitStrongEntityRelations,
} from '../strongEntityPresentation'

const createEntity = (overrides: Partial<StrongLexiconEntity> = {}): StrongLexiconEntity => ({
  id: 1,
  uniqueName: 'Peter@Matt.4.18',
  uStrong: 'G4074G',
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
      showsRelationshipGraph: kind === 'person' || kind === 'group',
    })
  })

  it('keeps six prioritized personal relations in the graph and lists the rest', () => {
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
    ])
    expect(result.remaining.map(item => item.relation)).toEqual(['resident', 'founder_or_origin'])
  })

  it('uses a list instead of a relationship graph for places', () => {
    const relations = [{ relation: 'resident', certainty: 'asserted', targetName: 'Pierre' }]

    expect(splitStrongEntityRelations(createEntity({ category: 'place', relations }))).toEqual({
      graph: [],
      remaining: relations,
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
})
