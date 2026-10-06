import { useEffect, useRef, type CSSProperties } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { TIMELINE_MESSAGES } from './messages'
import type { TimelineIndexPageData } from './timeline.functions'
import { formatTimelineDates, formatTimelineYear, TIMELINE_FUTURE_YEAR } from './timelineDates'
import {
  buildTimelineBands,
  timelineBandAt,
  timelinePeriodExtents,
  timelineTicks,
  timelineXToYear,
} from './timelineGeometry'
import { findTimelinePeriod, TIMELINE_SCALES } from './timelinePeriods'
import { buildTimelineEventPath, timelineEventAnchor } from './timelineRoutes'

const BANDS = buildTimelineBands(TIMELINE_SCALES)
const EXTENTS = timelinePeriodExtents(BANDS)
const TICKS = BANDS.flatMap(timelineTicks)

/** A pointer has to travel this far before a press becomes a drag. */
const DRAG_THRESHOLD = 5

const periodStyle = (color: string | undefined, style: CSSProperties = {}): CSSProperties =>
  ({ ...style, ...(color ? { '--timeline-period': color } : {}) }) as CSSProperties

const bandAnchor = (period: string): string => `timeline-period-${period}`

/**
 * The timeline drawn as one long axis: periods follow one another, each at its own scale,
 * and events sit above and under the axis. It scrolls sideways only, so the page keeps
 * scrolling the usual way; every event is a plain link, and the script only adds comfort:
 * dragging with a mouse, stepping buttons, the year under the middle of the view.
 */
export default function TimelineCanvas({
  language,
  periods,
  canvas,
}: {
  language: ResourceLanguage
  periods: TimelineIndexPageData['periods']
  canvas: TimelineIndexPageData['canvas']
}) {
  const messages = TIMELINE_MESSAGES[language]
  const stageRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const scroller = scrollerRef.current
    const year = yearRef.current
    if (!stage || !scroller || !year) return

    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scrollTo = (left: number) =>
      scroller.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })

    // The year and the period under the middle of the view.
    let frame = 0
    const describe = () => {
      frame = 0
      const middle = scroller.scrollLeft + scroller.clientWidth / 2
      year.textContent = formatTimelineYear(timelineXToYear(BANDS, middle), language)
      const period = timelineBandAt(BANDS, middle)?.id
      for (const link of stage.querySelectorAll<HTMLAnchorElement>('a[data-period]')) {
        if (link.dataset.period === period) link.setAttribute('aria-current', 'true')
        else link.removeAttribute('aria-current')
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(describe)
    }

    // Controls that only work with the script are revealed by it.
    for (const control of stage.querySelectorAll<HTMLElement>('[data-enhanced]')) {
      control.hidden = false
    }
    describe()

    const onStageClick = (event: MouseEvent) => {
      const target = event.target as Element
      const period = target.closest<HTMLAnchorElement>('a[data-period]')
      if (period) {
        const extent = EXTENTS.find(candidate => candidate.id === period.dataset.period)
        if (!extent) return
        // The period slides into view; the page itself stays where it is.
        event.preventDefault()
        scrollTo(extent.left)
        return
      }
      const step = target.closest<HTMLButtonElement>('button[data-step]')
      if (step) scrollTo(scroller.scrollLeft + Number(step.dataset.step) * scroller.clientWidth * 0.8)
    }

    // A mouse drags the timeline; touch and trackpads already scroll it.
    let drag: { x: number; left: number; moved: boolean } | undefined
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      drag = { x: event.clientX, left: scroller.scrollLeft, moved: false }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return
      const distance = event.clientX - drag.x
      if (!drag.moved && Math.abs(distance) < DRAG_THRESHOLD) return
      drag.moved = true
      scroller.dataset.dragging = 'true'
      scroller.scrollLeft = drag.left - distance
    }
    const onPointerUp = () => {
      if (!drag) return
      const { moved } = drag
      drag = undefined
      delete scroller.dataset.dragging
      // The click that ends a drag must not open the event under the pointer.
      if (moved) {
        scroller.addEventListener('click', event => event.preventDefault(), {
          capture: true,
          once: true,
        })
      }
    }
    // Links and pictures would otherwise start a native drag of their own.
    const onDragStart = (event: DragEvent) => event.preventDefault()

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('pointerdown', onPointerDown)
    scroller.addEventListener('dragstart', onDragStart)
    stage.addEventListener('click', onStageClick)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('pointerdown', onPointerDown)
      scroller.removeEventListener('dragstart', onDragStart)
      stage.removeEventListener('click', onStageClick)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', onScroll)
    }
  }, [language])

  let futureNamed = false
  const tickLabel = (year: number | undefined): string | undefined => {
    // There is no year zero, and what is still to come is named once.
    if (year === undefined || year === 0) return undefined
    if (year < TIMELINE_FUTURE_YEAR) return String(Math.abs(year))
    if (futureNamed) return undefined
    futureNamed = true
    return messages.future
  }

  return (
    <section ref={stageRef} className="timeline-stage" aria-label={messages.canvas}>
      <nav className="timeline-strip" aria-label={messages.periods}>
        <ol>
          {EXTENTS.map(extent => {
            const period = findTimelinePeriod(extent.id)
            return (
              <li key={extent.id} style={periodStyle(period?.color)}>
                <a href={`#${bandAnchor(extent.id)}`} data-period={extent.id}>
                  {period?.title[language]}
                </a>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="timeline-frame">
        <div
          ref={scrollerRef}
          className="timeline-scroller"
          tabIndex={0}
          role="group"
          aria-label={messages.canvasHint}
        >
          <div className="timeline-canvas" style={{ width: canvas.width, height: canvas.height }}>
            {EXTENTS.map(extent => {
              const period = findTimelinePeriod(extent.id)
              return (
                <div
                  key={extent.id}
                  id={bandAnchor(extent.id)}
                  className="timeline-period"
                  style={periodStyle(period?.color, { left: extent.left, width: extent.width })}
                >
                  {period && (
                    <p className="timeline-period__label">
                      <span className="timeline-period__era">{period.era[language]}</span>
                      <span className="timeline-period__title">{period.title[language]}</span>
                      {period.span && (
                        <span className="timeline-period__span">{period.span[language]}</span>
                      )}
                    </p>
                  )}
                  <span className="timeline-period__axis" style={{ top: canvas.axisTop }} />
                </div>
              )
            })}

            <div className="timeline-ruler" style={{ top: canvas.axisTop }} aria-hidden="true">
              {TICKS.map(tick => (
                <span key={tick.left} className="timeline-tick" style={{ left: tick.left }}>
                  {tickLabel(tick.year)}
                </span>
              ))}
            </div>

            {periods.flatMap(group =>
              group.events.map(event => {
                if (!event.box) return null
                const [left, top, width] = event.box
                const color = findTimelinePeriod(group.id)?.color
                return event.card ? (
                  <a
                    key={event.slug}
                    id={timelineEventAnchor(event.slug)}
                    className="timeline-item timeline-item--card"
                    href={buildTimelineEventPath(language, event.slug)}
                    style={periodStyle(color, { left, top, width })}
                  >
                    <span className="timeline-item__text">
                      <span className="timeline-item__title">{event.title}</span>
                      <span className="timeline-item__dates">
                        {formatTimelineDates(event.dates, language)}
                      </span>
                    </span>
                    {event.thumbnail && (
                      <img
                        src={event.thumbnail}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </a>
                ) : (
                  <a
                    key={event.slug}
                    id={timelineEventAnchor(event.slug)}
                    className="timeline-item timeline-item--pill"
                    href={buildTimelineEventPath(language, event.slug)}
                    style={periodStyle(color, { left, top, maxWidth: width })}
                  >
                    <span className="timeline-item__title">{event.title}</span>
                  </a>
                )
              })
            )}
          </div>
        </div>

        <p className="timeline-cursor" style={{ top: canvas.axisTop }} data-enhanced hidden>
          <span ref={yearRef} />
        </p>
        <button
          type="button"
          className="timeline-step timeline-step--earlier"
          data-step="-1"
          data-enhanced
          hidden
          aria-label={messages.earlier}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m10 3-5 5 5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="timeline-step timeline-step--later"
          data-step="1"
          data-enhanced
          hidden
          aria-label={messages.later}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>
    </section>
  )
}
