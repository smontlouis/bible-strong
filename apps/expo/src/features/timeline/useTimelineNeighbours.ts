import type { ResourceLanguage } from '~helpers/databaseTypes'
import { useTimelineIndexQuery } from './TimelineResourceBoundary'
import { sortTimelineEvents } from './timelineStageModel'

/** The events before and after one, in the order of the timeline, as the public site lists them. */
export const useTimelineNeighbours = (slug: string, language: ResourceLanguage) => {
  const query = useTimelineIndexQuery(language)
  if (query.data?.status !== 'available') return {}
  const events = sortTimelineEvents(query.data.details)
  const index = events.findIndex(event => event.slug === slug)
  if (index === -1) return {}
  return { previous: events[index - 1], next: events[index + 1] }
}
