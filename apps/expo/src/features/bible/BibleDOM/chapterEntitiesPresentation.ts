import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'

export type ChapterEntitiesViewMode = 'hidden' | 'download' | 'empty' | 'entities'

export const getChapterEntitiesViewMode = (
  availabilityStatus: StrongLexiconModuleAvailability['status'] | null,
  loaded: boolean,
  entityCount: number
): ChapterEntitiesViewMode => {
  if (!availabilityStatus) return 'hidden'
  if (availabilityStatus !== 'available') return 'download'
  if (!loaded) return 'hidden'
  return entityCount ? 'entities' : 'empty'
}

/**
 * The painted characters of a chapter, persons and supernatural beings with a portrait, stand on
 * their own; places, groups and entities without a portrait stay in the stack (ADR-0090).
 */
export const splitChapterEntities = <T extends { uniqueName: string; category: string }>(
  entities: T[],
  portraits: Record<string, string>
) => {
  const isPainted = (entity: T) =>
    (entity.category === 'person' || entity.category === 'supernatural') &&
    !!portraits[entity.uniqueName]
  return {
    painted: entities.filter(isPainted),
    stacked: entities.filter(entity => !isPainted(entity)),
  }
}
