import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { TIMELINE_MESSAGES } from './messages'
import {
  loadTimelinePreview,
  type TimelineIndexEvent,
  type TimelinePreviewData,
} from './timeline.functions'
import { formatTimelineDates } from './timelineDates'
import type { TimelinePeriod } from './timelinePeriods'
import { buildTimelineEventPath } from './timelineRoutes'

// One request per event and language for the life of the page.
const previews = new Map<string, Promise<TimelinePreviewData>>()

const readPreview = (language: ResourceLanguage, slug: string): Promise<TimelinePreviewData> => {
  const key = `${language}:${slug}`
  let request = previews.get(key)
  if (!request) {
    request = loadTimelinePreview({ data: { language, slug } })
    previews.set(key, request)
    request.catch(() => previews.delete(key))
  }
  return request
}

const Arrow = ({ back = false }: { back?: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 16 16">
    <path d={back ? 'M13 8H3M7 4 3 8l4 4' : 'M3 8h10M9 4l4 4-4 4'} />
  </svg>
)

/**
 * An event opened on the drawn timeline: what it is, in a panel laid over the journey, and
 * the way to its page. Its neighbours in time are one step away.
 */
export default function TimelineEventPanel({
  language,
  event,
  period,
  previous,
  next,
  onSelect,
  onClose,
}: {
  language: ResourceLanguage
  event: TimelineIndexEvent
  period?: TimelinePeriod
  previous?: TimelineIndexEvent
  next?: TimelineIndexEvent
  onSelect: (slug: string) => void
  onClose: () => void
}) {
  const messages = TIMELINE_MESSAGES[language]
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [loaded, setLoaded] = useState<{ slug: string; preview?: TimelinePreviewData }>()
  const preview = loaded?.slug === event.slug ? loaded.preview : undefined
  const failed = loaded?.slug === event.slug && !loaded.preview

  useEffect(() => {
    let current = true
    readPreview(language, event.slug).then(
      result => current && setLoaded({ slug: event.slug, preview: result }),
      () => current && setLoaded({ slug: event.slug })
    )
    // The panel takes the focus, so a keyboard walks straight into what was opened.
    titleRef.current?.focus({ preventScroll: true })
    return () => {
      current = false
    }
  }, [language, event.slug])

  return (
    <aside
      className="timeline-panel"
      data-timeline-panel
      role="dialog"
      aria-labelledby="timeline-panel-title"
      style={period ? ({ '--timeline-period': period.color } as CSSProperties) : undefined}
    >
      <button type="button" className="timeline-panel__close" onClick={onClose}>
        <span className="sr-only">{messages.panelClose}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </button>

      <div className="timeline-panel__scroll">
        {/* Keyed by event, so stepping to a neighbour replays the entrance of the content. */}
        <div key={event.slug} className="timeline-panel__content">
          {(preview?.image ?? event.thumbnail) && (
            <div
              className="timeline-panel__media"
              style={event.thumbnail ? { backgroundImage: `url("${event.thumbnail}")` } : undefined}
            >
              {preview?.image && (
                <img src={preview.image} alt="" decoding="async" referrerPolicy="no-referrer" />
              )}
            </div>
          )}

          <div className="timeline-panel__body">
            {period && (
              <p className="timeline-panel__period">
                <span aria-hidden="true" />
                {period.title[language]}
              </p>
            )}
            <h2 id="timeline-panel-title" ref={titleRef} tabIndex={-1}>
              {event.title}
            </h2>
            <p className="timeline-panel__dates">{formatTimelineDates(event.dates, language)}</p>

            {preview ? (
              <>
                {preview.summary && <p className="timeline-panel__summary">{preview.summary}</p>}
                {preview.excerpt && <p className="timeline-panel__excerpt">{preview.excerpt}</p>}
              </>
            ) : failed ? (
              <p className="timeline-panel__excerpt">{messages.panelError}</p>
            ) : (
              <p className="timeline-panel__loading" role="status">
                <span className="sr-only">{messages.panelLoading}</span>
                <i />
                <i />
                <i />
              </p>
            )}

            <a className="resource-cta" href={buildTimelineEventPath(language, event.slug)}>
              {messages.panelRead}
              <Arrow />
            </a>
          </div>
        </div>
      </div>

      <div className="timeline-panel__steps">
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && onSelect(previous.slug)}
          aria-label={previous ? `${messages.previous} – ${previous.title}` : messages.previous}
        >
          <Arrow back />
          <span>{previous?.title ?? messages.previous}</span>
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next.slug)}
          aria-label={next ? `${messages.next} – ${next.title}` : messages.next}
        >
          <span>{next?.title ?? messages.next}</span>
          <Arrow />
        </button>
      </div>
    </aside>
  )
}
