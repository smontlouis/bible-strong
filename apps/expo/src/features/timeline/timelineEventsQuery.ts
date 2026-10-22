import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { getEvents } from './events'

// The timeline sections ship with the app: the file is read and parsed once a session for
// every screen that shows it, not at each mount or return to the foreground.
export const timelineEventsQueryOptions = {
  queryKey: ['timeline'] as const,
  queryFn: getEvents,
  ...staticResourceQueryOptions,
}
