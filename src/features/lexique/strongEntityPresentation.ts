import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
} from '~features/resources/strongLexiconAccess'

export type StrongEntityPresentationKind = 'person' | 'place' | 'group' | 'other'
export type StrongEntityAvatarKey =
  | 'male'
  | 'female'
  | 'group'
  | 'place'
  | 'supernatural'
  | 'time'
  | 'musical'
  | 'other'
  | 'title'
  | 'language'
  | 'star'

const OTHER_ENTITY_AVATARS: Record<string, StrongEntityAvatarKey> = {
  supernatural: 'supernatural',
  time: 'time',
  musical: 'musical',
  other: 'other',
  title: 'title',
  language: 'language',
  star: 'star',
}

export const getStrongEntityAvatarKey = (category: string, type: string): StrongEntityAvatarKey => {
  if (category === 'person') return type.toLowerCase() === 'female' ? 'female' : 'male'
  if (category === 'group') return 'group'
  if (category === 'place') return 'place'
  if (category !== 'other') return 'other'
  return OTHER_ENTITY_AVATARS[type.toLowerCase()] ?? 'other'
}

const ENTITY_PRESENTATIONS = {
  person: {
    kind: 'person',
    icon: 'user',
    showsRelationshipGraph: true,
  },
  place: {
    kind: 'place',
    icon: 'map-pin',
    showsRelationshipGraph: false,
  },
  group: {
    kind: 'group',
    icon: 'users',
    showsRelationshipGraph: true,
  },
  other: {
    kind: 'other',
    icon: 'bookmark',
    showsRelationshipGraph: false,
  },
} as const

export const getStrongEntityPresentation = (entity: StrongLexiconEntity) => {
  const category = entity.category as StrongEntityPresentationKind
  return ENTITY_PRESENTATIONS[category] ?? ENTITY_PRESENTATIONS.other
}

const PERSONAL_RELATION_PRIORITY = ['father', 'mother', 'partner', 'sibling', 'offspring'] as const

export const splitStrongEntityRelations = (
  entity: StrongLexiconEntity
): {
  graph: StrongLexiconEntityRelation[]
  remaining: StrongLexiconEntityRelation[]
} => {
  if (!getStrongEntityPresentation(entity).showsRelationshipGraph) {
    return { graph: [], remaining: entity.relations }
  }

  const prioritized = entity.relations
    .map((relation, index) => ({
      relation,
      index,
      priority: PERSONAL_RELATION_PRIORITY.indexOf(
        relation.relation as (typeof PERSONAL_RELATION_PRIORITY)[number]
      ),
    }))
    .sort((left, right) => {
      const leftPriority = left.priority === -1 ? PERSONAL_RELATION_PRIORITY.length : left.priority
      const rightPriority =
        right.priority === -1 ? PERSONAL_RELATION_PRIORITY.length : right.priority
      return leftPriority - rightPriority || left.index - right.index
    })

  const graph = prioritized.map(item => item.relation)
  return {
    graph,
    remaining: [],
  }
}

const ROOT_RELATION_PAGE_SIZE = 6
const NESTED_RELATION_PAGE_SIZE = 5

export const getStrongEntityRelationPage = (
  relations: StrongLexiconEntityRelation[],
  previousEntityUniqueName: string | undefined,
  requestedPageIndex: number
) => {
  const navigableRelations = previousEntityUniqueName
    ? relations.filter(relation => relation.targetUniqueName !== previousEntityUniqueName)
    : relations
  const pageSize = previousEntityUniqueName ? NESTED_RELATION_PAGE_SIZE : ROOT_RELATION_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(navigableRelations.length / pageSize))
  const pageIndex = Math.max(0, Math.min(requestedPageIndex, pageCount - 1))

  return {
    pageIndex,
    pageCount,
    relations: navigableRelations.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
  }
}
