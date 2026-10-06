import type { CSSProperties } from 'react'
import ResourceShell from '../resources/ResourceShell'
import { TIMELINE_MESSAGES } from './messages'
import type { TimelineIndexPageData } from './timeline.functions'
import TimelineEventList from './TimelineEventList'
import { findTimelinePeriod } from './timelinePeriods'
import {
  buildTimelineIndexPath,
  buildWebAppTimelineUrl,
  timelinePeriodAnchor,
} from './timelineRoutes'

// The colour of a period is decoration: it only tints the markers of its rail.
const periodColor = (color: string | undefined) =>
  (color ? { '--timeline-period': color } : undefined) as CSSProperties | undefined

/** `/timeline/:language` — every event of the timeline, period by period. */
export default function TimelineIndexPage({ page }: { page: TimelineIndexPageData }) {
  const { language } = page
  const messages = TIMELINE_MESSAGES[language]
  const periods = page.periods.map(group => {
    const period = findTimelinePeriod(group.id)
    return {
      ...group,
      period,
      anchor: timelinePeriodAnchor(group.id || 'other'),
      title: period?.title[language] ?? messages.otherEvents,
      count: messages.periodEvents.replace('{count}', group.events.length.toLocaleString(language)),
    }
  })

  return (
    <ResourceShell
      section="timeline"
      alternatePath={
        page.translated ? buildTimelineIndexPath(language === 'fr' ? 'en' : 'fr') : undefined
      }
      appUrl={buildWebAppTimelineUrl(language)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">{messages.name}</h1>
          <p className="resource-prose mt-5">{messages.indexIntro}</p>
          <p className="resource-muted mt-3 text-sm">
            {messages.indexCount
              .replace('{events}', page.eventCount.toLocaleString(language))
              .replace('{periods}', String(periods.length))}
          </p>
        </header>

        <nav className="mt-8" aria-label={messages.periods}>
          <ol className="timeline-periods">
            {periods.map(({ id, period, anchor, title }) => (
              <li key={id} style={periodColor(period?.color)}>
                <a className="timeline-periods__period" href={`#${anchor}`}>
                  <span className="timeline-marker" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{title}</span>{' '}
                    {period?.span && (
                      <span className="resource-muted block text-sm">{period.span[language]}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {periods.map(({ id, period, anchor, title, count, events }) => (
          <section
            key={id}
            id={anchor}
            className="mt-14 scroll-mt-24"
            style={periodColor(period?.color)}
          >
            {period && (
              <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
                {period.era[language]}
              </p>
            )}
            <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
            <p className="resource-muted mt-1 text-sm">
              {period?.span ? `${period.span[language]} · ${count}` : count}
            </p>
            {period && <p className="resource-prose mt-3">{period.summary[language]}</p>}
            <div className="mt-5">
              <TimelineEventList events={events} language={language} />
            </div>
          </section>
        ))}
      </article>
    </ResourceShell>
  )
}
