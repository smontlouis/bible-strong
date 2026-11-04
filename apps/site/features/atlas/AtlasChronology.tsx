import SiteLink from '@/components/SiteLink'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { TIMELINE_MESSAGES } from '../timeline/messages'
import type {
  AtlasChronology as AtlasChronologyData,
  AtlasChronologyEvent,
} from './atlasChronologyData'
import { ATLAS_MESSAGES, countLabel } from './messages'

/** Up to this many events stand side by side; more run in a strip that scrolls. */
const EVENTS_ON_ONE_ROW = 3

const eventAnchor = (slug: string) => `chronology-${slug}`

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

const Arrow = ({ direction }: { direction: 'previous' | 'next' }) => (
  <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
    <path
      d={direction === 'previous' ? 'm12 4.5-5.5 5.5 5.5 5.5' : 'm8 4.5 5.5 5.5-5.5 5.5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const Thumbnail = ({ src }: { src?: string }) => (
  <span className="atlas-chronology__frame">
    {src && (
      <img
        src={src}
        alt=""
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    )}
  </span>
)

/**
 * What the timeline holds on an entity: the event about it, a ruler that shows the shape of a
 * life, and the events one after the other. Each event is a link without the script; the script
 * ties the ruler and the strip together.
 */
export default function AtlasChronology({
  chronology,
  language,
}: {
  chronology: AtlasChronologyData
  language: ResourceLanguage
}) {
  const { lead, events, ruler, periods, placePath } = chronology
  const messages = ATLAS_MESSAGES[language]
  const strip = useRef<HTMLOListElement>(null)
  const [seen, setSeen] = useState<{ first: number; last: number }>()
  const [pointed, setPointed] = useState<number>()
  const scrolls = events.length > EVENTS_ON_ONE_ROW

  useEffect(() => {
    const list = strip.current
    if (!list) return
    let frame = 0
    const measure = () => {
      frame = 0
      const { left, right } = list.getBoundingClientRect()
      const shown = [...list.children].flatMap((item, index) => {
        const box = item.getBoundingClientRect()
        const middle = box.left + box.width / 2
        return middle >= left && middle <= right ? [index] : []
      })
      if (shown.length === 0) return
      const first = shown[0]
      const last = shown[shown.length - 1]
      setSeen(current =>
        current?.first === first && current.last === last ? current : { first, last }
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    list.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      list.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const reveal = (index: number) => (event: MouseEvent) => {
    const item = strip.current?.children[index]
    if (!item) return
    event.preventDefault()
    item.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest', inline: 'start' })
  }

  const turn = (direction: -1 | 1) =>
    strip.current?.scrollBy({
      left: direction * strip.current.clientWidth * 0.8,
      behavior: scrollBehavior(),
    })

  const card = (event: AtlasChronologyEvent, index: number) => {
    const period = periods.find(item => item.id === event.period)
    return (
      <li key={event.slug} id={eventAnchor(event.slug)}>
        <SiteLink
          className="atlas-chronology__event"
          href={event.path}
          onMouseEnter={() => setPointed(index)}
          onMouseLeave={() => setPointed(undefined)}
          onFocus={() => setPointed(index)}
          onBlur={() => setPointed(undefined)}
        >
          <Thumbnail src={event.thumbnail} />
          <span className="atlas-chronology__dates">
            {period && (
              <span
                className="timeline-marker"
                style={{ '--timeline-period': period.color } as CSSProperties}
                aria-hidden="true"
              />
            )}
            {event.dates}
          </span>
          <span className="atlas-chronology__title">{event.title}</span>
        </SiteLink>
      </li>
    )
  }

  const pointedEvent = pointed === undefined ? undefined : events[pointed]

  return (
    <section className="atlas-entity__section atlas-entity__section--wide" id="chronology">
      <div className="atlas-chronology__head">
        <h2 className="atlas-heading">{messages.chronology}</h2>
        <div className="atlas-chronology__actions">
          <SiteLink className="resource-link" href={placePath}>
            {TIMELINE_MESSAGES[language].locate}
          </SiteLink>
          {scrolls && (
            <div className="atlas-chronology__arrows">
              <button
                type="button"
                aria-label={messages.chronologyPrevious}
                disabled={!seen || seen.first === 0}
                onClick={() => turn(-1)}
              >
                <Arrow direction="previous" />
              </button>
              <button
                type="button"
                aria-label={messages.chronologyNext}
                disabled={seen?.last === events.length - 1}
                onClick={() => turn(1)}
              >
                <Arrow direction="next" />
              </button>
            </div>
          )}
        </div>
      </div>

      {lead && (
        <SiteLink className="atlas-chronology__lead" href={lead.path}>
          <Thumbnail src={lead.thumbnail} />
          <span className="atlas-chronology__lead-text">
            <span className="atlas-chronology__lead-title">{lead.title}</span>
            <span className="atlas-chronology__dates">{lead.dates}</span>
            {lead.summary && <span className="atlas-chronology__summary">{lead.summary}</span>}
          </span>
        </SiteLink>
      )}

      {ruler && (
        <div
          className="atlas-chronology__ruler"
          style={
            {
              '--timeline-period': ruler.color,
              '--ruler-levels': ruler.levels,
            } as CSSProperties
          }
        >
          {/* The cards say all of this: the ruler is for the eye and the pointer. */}
          <div className="atlas-chronology__axis" aria-hidden="true">
            {ruler.marks.map(mark => {
              const event = events[mark.event]
              const isSeen = !seen || (mark.event >= seen.first && mark.event <= seen.last)
              return (
                <a
                  key={event.slug}
                  className="atlas-chronology__mark"
                  href={`#${eventAnchor(event.slug)}`}
                  tabIndex={-1}
                  data-seen={isSeen || undefined}
                  data-pointed={mark.event === pointed || undefined}
                  style={
                    {
                      '--mark-left': `${mark.left}%`,
                      '--mark-width': `${mark.width}%`,
                      '--mark-level': mark.level,
                    } as CSSProperties
                  }
                  onClick={reveal(mark.event)}
                  onMouseEnter={() => setPointed(mark.event)}
                  onMouseLeave={() => setPointed(undefined)}
                />
              )
            })}
          </div>
          <p className="atlas-chronology__scale">
            <span>{ruler.from}</span>
            <span className="atlas-chronology__pointed">
              {pointedEvent
                ? `${pointedEvent.dates} · ${pointedEvent.title}`
                : countLabel(messages.chronologyEvents, events.length, language)}
            </span>
            <span>{ruler.to}</span>
          </p>
        </div>
      )}

      {periods.length > 0 && (
        <ul className="atlas-chronology__periods">
          {periods.map(period => (
            <li key={period.id}>
              <a
                className="resource-chip"
                href={`#${eventAnchor(events[period.first].slug)}`}
                style={{ '--timeline-period': period.color } as CSSProperties}
                onClick={reveal(period.first)}
              >
                <span className="timeline-marker self-center" aria-hidden="true" />
                {period.title}
                <span className="resource-muted"> · {period.count}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 &&
        (scrolls ? (
          <ol ref={strip} className="atlas-strip atlas-chronology__strip">
            {events.map(card)}
          </ol>
        ) : (
          <ol ref={strip} className="atlas-chronology__row">
            {events.map(card)}
          </ol>
        ))}
    </section>
  )
}
