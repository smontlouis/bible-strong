import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { RESOURCE_SECTIONS } from '../resources/sections'
import { TIMELINE_MESSAGES } from './messages'
import type { TimelineIndexEvent, TimelineIndexPageData } from './timeline.functions'
import {
  formatTimelineDates,
  formatTimelineYear,
  formatTimelineYearNumber,
  TIMELINE_FUTURE_YEAR,
} from './timelineDates'
import TimelineEventPanel from './TimelineEventPanel'
import {
  TIMELINE_RULER_HEIGHT,
  timelineBandAt,
  timelinePeriodExtents,
  timelineTicks,
  timelineWidth,
  timelineXToYear,
} from './timelineGeometry'
import {
  findTimelinePeriod,
  TIMELINE_BANDS,
  TIMELINE_INTRO_WIDTH,
  TIMELINE_OUTRO_WIDTH,
} from './timelinePeriods'
import {
  buildTimelineEventPath,
  timelineEventAnchor,
  timelinePeriodAnchor,
} from './timelineRoutes'
import { createTimelineTravel, type TimelineTravel } from './timelineTravel'

const EXTENTS = timelinePeriodExtents(TIMELINE_BANDS)
const TICKS = TIMELINE_BANDS.flatMap(timelineTicks)
const AXIS_END = timelineWidth(TIMELINE_BANDS)

type StageEvent = TimelineIndexEvent & {
  period: string
  box: [left: number, top: number, width: number]
}

const periodStyle = (color: string | undefined, style: CSSProperties = {}): CSSProperties =>
  ({ ...style, ...(color ? { '--timeline-period': color } : {}) }) as CSSProperties

/** With an event open, these keys step to the one before or after it. */
const NEIGHBOUR_KEYS: Record<string, number | undefined> = { ArrowLeft: -1, ArrowRight: 1 }

/** The year a tick names: none where there is no year zero, and the future only once. */
const tickLabels = (future: string): (string | undefined)[] => {
  let futureNamed = false
  return TICKS.map(({ year }) => {
    if (year === undefined || year === 0) return undefined
    if (year < TIMELINE_FUTURE_YEAR) return String(Math.abs(year))
    if (futureNamed) return undefined
    futureNamed = true
    return future
  })
}

/**
 * The timeline as a place to travel: one axis running through thirteen periods, each with
 * its scene, and every event on a lane above it. The stage fills the window and moves
 * like a map. Every event is a plain link; with the script, it opens in a panel so the
 * journey is not interrupted.
 */
export default function TimelineStage({ page }: { page: TimelineIndexPageData }) {
  const { language, canvas } = page
  const messages = TIMELINE_MESSAGES[language]
  const stageRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const yearRef = useRef<HTMLParagraphElement>(null)
  const mapRef = useRef<HTMLOListElement>(null)
  const windowRef = useRef<HTMLSpanElement>(null)
  const travelRef = useRef<TimelineTravel>(undefined)
  const [enhanced, setEnhanced] = useState(false)
  const [selected, setSelected] = useState<string>()

  const events: StageEvent[] = page.periods.flatMap(group =>
    group.events.flatMap(event =>
      event.box ? [{ ...event, period: group.id, box: event.box }] : []
    )
  )
  const selectedIndex = events.findIndex(event => event.slug === selected)
  const selectedEvent = events[selectedIndex]

  useEffect(() => {
    const stage = stageRef.current
    const scroller = scrollerRef.current
    const map = mapRef.current
    if (!stage || !scroller || !map) return

    const travel = createTimelineTravel(scroller, target =>
      Boolean((target as Element | null)?.closest?.('[data-timeline-panel]'))
    )
    travelRef.current = travel

    // Where a position of the drawing stands on the strip of periods, and back.
    const segments = () => {
      const origin = map.getBoundingClientRect().left
      return [...map.querySelectorAll<HTMLElement>('[data-period]')].map((element, index) => {
        const box = element.getBoundingClientRect()
        return { extent: EXTENTS[index], left: box.left - origin, width: box.width }
      })
    }
    const toMap = (x: number): number => {
      const all = segments()
      const segment = all.find(({ extent }) => extent && x < extent.left + extent.width) ?? all.at(-1)
      if (!segment?.extent) return 0
      const within = Math.min(Math.max(x - segment.extent.left, 0), segment.extent.width)
      return segment.left + (within / segment.extent.width) * segment.width
    }
    const fromMap = (x: number): number => {
      const all = segments()
      const segment = all.find(candidate => x < candidate.left + candidate.width) ?? all.at(-1)
      if (!segment?.extent) return 0
      const within = Math.min(Math.max(x - segment.left, 0), segment.width)
      return segment.extent.left + (within / segment.width) * segment.extent.width
    }

    // The year and the period under the middle of the view.
    let frame = 0
    const describe = () => {
      frame = 0
      const middle = scroller.scrollLeft + scroller.clientWidth / 2
      const year = timelineXToYear(TIMELINE_BANDS, middle)
      if (cursorRef.current) cursorRef.current.textContent = formatTimelineYear(year, language)
      // Behind the drawing the year stands alone, as a number; the cursor names its era.
      if (yearRef.current) yearRef.current.dataset.year = formatTimelineYearNumber(year)
      const inTime = middle >= TIMELINE_INTRO_WIDTH && middle <= AXIS_END
      stage.dataset.inTime = String(inTime)
      const period = inTime ? timelineBandAt(TIMELINE_BANDS, middle)?.id : undefined
      for (const link of map.querySelectorAll<HTMLElement>('[data-period]')) {
        if (link.dataset.period === period) link.setAttribute('aria-current', 'true')
        else link.removeAttribute('aria-current')
      }
      const view = windowRef.current
      if (view) {
        const left = toMap(scroller.scrollLeft)
        view.style.left = `${left}px`
        view.style.width = `${Math.max(toMap(scroller.scrollLeft + scroller.clientWidth) - left, 6)}px`
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(describe)
    }

    // Pressing the strip of periods carries the view there, and dragging scrubs through time.
    let scrubbing = false
    const scrub = (event: PointerEvent) => {
      travel.rest()
      const x = event.clientX - map.getBoundingClientRect().left
      scroller.scrollLeft = fromMap(x) - scroller.clientWidth / 2
    }
    const onMapPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      scrubbing = true
      scrub(event)
      // Capture keeps the scrub going when the pointer leaves the strip; a pointer the
      // browser no longer tracks cannot be captured, and the press has moved the view anyway.
      try {
        map.setPointerCapture(event.pointerId)
      } catch {
        scrubbing = false
      }
    }
    const onMapPointerMove = (event: PointerEvent) => {
      if (scrubbing) scrub(event)
    }
    const onMapPointerUp = () => {
      scrubbing = false
    }

    // The view rests on the axis: a window too short for every lane opens on the lowest.
    scroller.scrollTop = scroller.scrollHeight
    const located = decodeURIComponent(window.location.hash.slice(1))
    if (located.startsWith('on-')) setSelected(located.slice(3))
    setEnhanced(true)
    describe()

    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    map.addEventListener('pointerdown', onMapPointerDown)
    map.addEventListener('pointermove', onMapPointerMove)
    map.addEventListener('pointerup', onMapPointerUp)
    map.addEventListener('pointercancel', onMapPointerUp)
    return () => {
      cancelAnimationFrame(frame)
      travel.dispose()
      travelRef.current = undefined
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      map.removeEventListener('pointerdown', onMapPointerDown)
      map.removeEventListener('pointermove', onMapPointerMove)
      map.removeEventListener('pointerup', onMapPointerUp)
      map.removeEventListener('pointercancel', onMapPointerUp)
    }
  }, [language])

  // An opened event comes to the open part of the view, and the address remembers it.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (!selected) {
      if (window.location.hash.startsWith('#on-')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      return
    }
    window.history.replaceState(null, '', `#${timelineEventAnchor(selected)}`)
    const item = document.getElementById(timelineEventAnchor(selected))
    if (!item) return
    const panel = stageRef.current?.querySelector<HTMLElement>('[data-timeline-panel]')
    // A panel beside the view takes its width away; a sheet under it takes its height.
    const beside = panel && panel.offsetHeight > scroller.clientHeight * 0.8 ? panel.offsetWidth : 0
    const under = panel && !beside ? panel.offsetHeight : 0
    const box = item.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    travelRef.current?.goTo(
      scroller.scrollLeft + box.left - view.left - (scroller.clientWidth - beside) * 0.3,
      scroller.scrollTop + box.top - view.top - (scroller.clientHeight - under) / 2 + box.height / 2
    )
  }, [selected])

  const goToPeriod = (id: string | undefined) => {
    const extent = EXTENTS.find(candidate => candidate.id === id)
    if (extent) travelRef.current?.goTo(extent.left)
  }

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    if (!enhanced || event.defaultPrevented || event.button !== 0 || modified) return
    const target = event.target as Element
    const opened = target.closest<HTMLAnchorElement>('a[data-event]')?.dataset.event
    if (opened) {
      event.preventDefault()
      setSelected(opened)
      return
    }
    const period = target.closest<HTMLAnchorElement>('a[data-period]')
    if (!period) return
    // The period slides into view; the address stays the one of the timeline.
    event.preventDefault()
    // A press on the strip has already carried the view where it landed; only a keyboard
    // reaches the strip without pressing it.
    if (!period.closest('.timeline-map') || event.detail === 0) goToPeriod(period.dataset.period)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const scroller = scrollerRef.current
    if (!scroller || event.metaKey || event.ctrlKey || event.altKey) return
    if (selected) {
      // With an event open, the arrows walk from one event to the next.
      const neighbour = events[selectedIndex + (NEIGHBOUR_KEYS[event.key] ?? 0)]
      if (event.key === 'Escape') setSelected(undefined)
      else if (neighbour && neighbour.slug !== selected) setSelected(neighbour.slug)
      else return
      event.preventDefault()
      return
    }
    const middle = scroller.scrollLeft + scroller.clientWidth / 2
    const current = EXTENTS.findIndex(extent => middle < extent.left + extent.width)
    const destinations: Record<string, number | undefined> = {
      ArrowLeft: scroller.scrollLeft - scroller.clientWidth * 0.3,
      ArrowRight: scroller.scrollLeft + scroller.clientWidth * 0.3,
      PageUp: EXTENTS[Math.max(current - 1, 0)]?.left,
      PageDown: EXTENTS[current + 1]?.left ?? AXIS_END,
      Home: 0,
      End: scroller.scrollWidth,
    }
    const destination = destinations[event.key]
    if (destination === undefined) return
    event.preventDefault()
    travelRef.current?.goTo(destination)
  }

  const labels = tickLabels(messages.future)

  return (
    <section
      ref={stageRef}
      className="timeline-stage"
      aria-label={messages.canvas}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {/* Decoration: the year is drawn by the stylesheet, and read from the cursor. */}
      <p ref={yearRef} className="timeline-year" aria-hidden="true" hidden={!enhanced} />

      <div
        ref={scrollerRef}
        className="timeline-scroller"
        tabIndex={0}
        role="group"
        aria-label={messages.canvasHint}
      >
        <div
          className="timeline-canvas"
          style={
            {
              width: canvas.width,
              '--timeline-drawing-height': `${canvas.height + TIMELINE_RULER_HEIGHT}px`,
            } as CSSProperties
          }
        >
          <header className="timeline-intro" style={{ width: TIMELINE_INTRO_WIDTH }}>
            <p className="timeline-intro__eyebrow">{messages.introEyebrow}</p>
            <h1>{messages.name}</h1>
            <p className="timeline-intro__lead">
              {messages.introLead.replace('{events}', page.eventCount.toLocaleString(language))}
            </p>
            <a
              className="resource-cta"
              href={`#${timelinePeriodAnchor(EXTENTS[0]?.id ?? '')}`}
              data-period={EXTENTS[0]?.id}
            >
              {messages.introStart}
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
          </header>

          {EXTENTS.map((extent, index) => {
            const period = findTimelinePeriod(extent.id)
            if (!period) return null
            return (
              <section
                key={extent.id}
                className="timeline-period"
                style={periodStyle(period.color, { left: extent.left, width: extent.width })}
              >
                {/* A link to the period lands where it starts, down on the axis. */}
                <span id={timelinePeriodAnchor(extent.id)} className="timeline-period__anchor" />
                <div className="timeline-period__scene">
                  <img
                    src={`/images/timeline/period-${extent.id}.jpg`}
                    alt=""
                    width={640}
                    height={800}
                    loading={index === 0 ? undefined : 'lazy'}
                    decoding="async"
                  />
                </div>
                <div className="timeline-period__name">
                  <p className="timeline-period__era">
                    <span className="timeline-period__number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {period.era[language]}
                  </p>
                  <h2>{period.title[language]}</h2>
                  {period.span && <p className="timeline-period__span">{period.span[language]}</p>}
                  <p className="timeline-period__summary">{period.summary[language]}</p>
                </div>
              </section>
            )
          })}

          <footer
            className="timeline-outro"
            style={{ left: AXIS_END, width: TIMELINE_OUTRO_WIDTH }}
          >
            <h2>{messages.outroTitle}</h2>
            <p>{messages.outroLead}</p>
            <a
              className="resource-cta"
              href={`#${timelinePeriodAnchor(EXTENTS[0]?.id ?? '')}`}
              data-period={EXTENTS[0]?.id}
            >
              {messages.outroRestart}
            </a>
            <ul>
              {RESOURCE_SECTIONS.filter(section => section.key !== 'timeline').map(section => (
                <li key={section.key}>
                  <a href={section.path(language)}>{section.label[language]}</a>
                </li>
              ))}
            </ul>
          </footer>

          <div className="timeline-world" style={{ height: canvas.height }}>
            {events.map(event => {
              const [left, top, width] = event.box
              const color = findTimelinePeriod(event.period)?.color
              const shared = {
                id: timelineEventAnchor(event.slug),
                href: buildTimelineEventPath(language, event.slug),
                'data-event': event.slug,
                'aria-current': event.slug === selected ? ('true' as const) : undefined,
              }
              return event.card ? (
                <a
                  key={event.slug}
                  {...shared}
                  className="timeline-item timeline-item--card"
                  style={periodStyle(color, { left, top, width })}
                >
                  <span className="timeline-card">
                    {event.thumbnail && (
                      <img
                        src={event.thumbnail}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="timeline-card__text">
                      <span className="timeline-card__title">{event.title}</span>
                      <span className="timeline-card__dates">
                        {formatTimelineDates(event.dates, language)}
                      </span>
                    </span>
                  </span>
                </a>
              ) : (
                <a
                  key={event.slug}
                  {...shared}
                  className="timeline-item timeline-item--pill"
                  style={periodStyle(color, { left, top, maxWidth: width })}
                >
                  <span>{event.title}</span>
                </a>
              )
            })}
          </div>

          <div className="timeline-ruler" style={{ height: TIMELINE_RULER_HEIGHT }}>
            <div aria-hidden="true">
              {EXTENTS.map(extent => (
                <span
                  key={extent.id}
                  className="timeline-ruler__axis"
                  style={periodStyle(findTimelinePeriod(extent.id)?.color, {
                    left: extent.left,
                    width: extent.width,
                  })}
                />
              ))}
              {TICKS.map((tick, index) => (
                <span key={tick.left} className="timeline-tick" style={{ left: tick.left }}>
                  {labels[index]}
                </span>
              ))}
            </div>
            <p className="timeline-cursor" hidden={!enhanced}>
              <span ref={cursorRef} />
            </p>
          </div>
        </div>
      </div>

      <nav className="timeline-map" aria-label={messages.periods}>
        <ol ref={mapRef}>
          {EXTENTS.map((extent, index) => {
            const period = findTimelinePeriod(extent.id)
            return (
              <li
                key={extent.id}
                style={periodStyle(period?.color, { flexGrow: Math.round(extent.width / 100) })}
              >
                <a
                  href={`#${timelinePeriodAnchor(extent.id)}`}
                  data-period={extent.id}
                  draggable={false}
                  // A period too short for its name only shows its number.
                  aria-label={`${String(index + 1).padStart(2, '0')} ${period?.title[language]}`}
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{period?.title[language]}</span>
                </a>
              </li>
            )
          })}
        </ol>
        <span ref={windowRef} className="timeline-map__window" hidden={!enhanced} />
      </nav>

      {selectedEvent && (
        <TimelineEventPanel
          language={language}
          event={selectedEvent}
          period={findTimelinePeriod(selectedEvent.period)}
          previous={events[selectedIndex - 1]}
          next={events[selectedIndex + 1]}
          onSelect={setSelected}
          onClose={() => {
            setSelected(undefined)
            document.getElementById(timelineEventAnchor(selectedEvent.slug))?.focus()
          }}
        />
      )}
    </section>
  )
}
