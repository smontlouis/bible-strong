import type { ResourceLanguage } from '../resources/publicSite'
import type { TimelineEventLink } from './timeline.functions'
import { formatTimelineDates } from './timelineDates'
import { buildTimelineEventPath } from './timelineRoutes'

/** Events in chronological order, each linked to its page, hung on the rail of the timeline. */
export default function TimelineEventList({
  events,
  language,
}: {
  events: TimelineEventLink[]
  language: ResourceLanguage
}) {
  return (
    <ol className="timeline-events">
      {events.map(event => (
        <li key={event.slug}>
          <a className="timeline-events__event" href={buildTimelineEventPath(language, event.slug)}>
            <span className="timeline-events__title">{event.title}</span>{' '}
            <span className="timeline-events__dates">
              {formatTimelineDates(event.dates, language)}
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}
