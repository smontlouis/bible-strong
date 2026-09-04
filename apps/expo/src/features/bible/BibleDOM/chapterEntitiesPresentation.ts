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
