import { useEffect, useId, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import type { AtlasMapPoint } from './atlas.functions'
import {
  ATLAS_HOLY_LAND_VIEW,
  ATLAS_MAP_HEIGHT,
  ATLAS_MAP_WIDTH,
  ATLAS_WHOLE_VIEW,
} from './atlasProjection'
import { buildAtlasEntityPath } from './atlasRoutes'
import { ATLAS_MESSAGES } from './messages'

type View = { x: number; y: number; width: number; height: number }

const MIN_WIDTH = 90
const MOVE_TOLERANCE = 4

/** Keeps a view inside the map, at its aspect, between the closest zoom and the whole map. */
const clampView = (view: View, aspect: number): View => {
  const width = Math.min(Math.max(view.width, MIN_WIDTH), ATLAS_MAP_WIDTH)
  const height = width * aspect
  const x = Math.min(Math.max(view.x, -width * 0.25), ATLAS_MAP_WIDTH - width * 0.75)
  const y = Math.min(Math.max(view.y, -height * 0.25), ATLAS_MAP_HEIGHT - height * 0.75)
  return { x, y, width, height }
}

/** A window of the given width centred on a point. */
const viewAround = (point: AtlasMapPoint, width: number, aspect: number): View => ({
  x: point[2] - width / 2,
  y: point[3] - (width * aspect) / 2,
  width,
  height: width * aspect,
})

/** A view framing a region, at the aspect of the frame. */
const fit = (region: View, aspect: number): View => {
  const width = Math.max(region.width, region.height / aspect)
  const height = width * aspect
  return {
    x: region.x + region.width / 2 - width / 2,
    y: region.y + region.height / 2 - height / 2,
    width,
    height,
  }
}

/**
 * The places of the Bible on one map, travelled like a map: drag to move, the wheel or the
 * buttons to zoom. The more a place is named, the sooner its name shows; a painted place
 * shows its painting once the map is close enough. Every place is a link to its page.
 */
export default function AtlasMap({
  language,
  points,
  focus,
  compact = false,
}: {
  language: ResourceLanguage
  points: AtlasMapPoint[]
  /** A place the map opens on and marks. */
  focus?: AtlasMapPoint
  compact?: boolean
}) {
  const messages = ATLAS_MESSAGES[language]
  // Clip paths are named by position: a unique name may hold characters an address cannot.
  const clipPrefix = `atlas-clip${useId().replace(/[^a-z0-9]/giu, '')}`
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: compact ? 640 : 1200, height: compact ? 360 : 640 })
  const aspect = frame.height / frame.width
  const opening = (ratio: number) =>
    focus ? viewAround(focus, compact ? 420 : 700, ratio) : fit(ATLAS_HOLY_LAND_VIEW, ratio)
  const [view, setView] = useState<View>(() => opening(aspect))
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; id: number }>(undefined)
  const suppressClick = useRef(false)
  // Until the reader moves the map, a new frame size opens it again on its first window.
  const touched = useRef(false)
  const openingRef = useRef(opening)
  openingRef.current = opening

  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      setFrame({ width, height })
      setView(current =>
        touched.current
          ? clampView({ ...current, height: current.width * (height / width) }, height / width)
          : openingRef.current(height / width)
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The wheel zooms the map, not the page: React listens passively, so it is bound here.
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const onWheel = (event: globalThis.WheelEvent) => event.preventDefault()
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    touched.current = true
    const rect = frameRef.current?.getBoundingClientRect()
    setView(current => {
      const px = rect && clientX !== undefined ? (clientX - rect.left) / rect.width : 0.5
      const py = rect && clientY !== undefined ? (clientY - rect.top) / rect.height : 0.5
      const width = Math.min(Math.max(current.width * factor, MIN_WIDTH), ATLAS_MAP_WIDTH)
      const height = width * aspect
      return clampView(
        {
          x: current.x + (current.width - width) * px,
          y: current.y + (current.height - height) * py,
          width,
          height,
        },
        aspect
      )
    })
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    zoomAt(Math.exp(event.deltaY * 0.0016), event.clientX, event.clientY)
  }

  // Two fingers on the map pinch it: the distance between them sets the zoom, their middle
  // stays under them.
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; view: View }>(undefined)
  const spread = () => {
    const [first, second] = [...fingers.current.values()]
    return first && second
      ? {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        }
      : undefined
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const both = spread()
    if (both) {
      drag.current = undefined
      pinch.current = { distance: both.distance, view }
      touched.current = true
      return
    }
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false, id: event.pointerId }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (fingers.current.has(event.pointerId)) {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }
    const both = spread()
    const rect = frameRef.current?.getBoundingClientRect()
    if (pinch.current && both && rect && both.distance > 0) {
      const start = pinch.current.view
      const width = Math.min(
        Math.max((start.width * pinch.current.distance) / both.distance, MIN_WIDTH),
        ATLAS_MAP_WIDTH
      )
      const px = (both.x - rect.left) / rect.width
      const py = (both.y - rect.top) / rect.height
      setView(
        clampView(
          {
            x: start.x + (start.width - width) * px,
            y: start.y + (start.width * aspect - width * aspect) * py,
            width,
            height: width * aspect,
          },
          aspect
        )
      )
      return
    }
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.moved && Math.hypot(dx, dy) < MOVE_TOLERANCE) return
    if (!current.moved) {
      current.moved = true
      touched.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const scale = current.view.width / frame.width
    setView(
      clampView(
        { ...current.view, x: current.view.x - dx * scale, y: current.view.y - dy * scale },
        aspect
      )
    )
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(event.pointerId)
    if (pinch.current) {
      // The pinch ends with its first lifted finger; the click it would make is not a tap.
      if (fingers.current.size < 2) {
        pinch.current = undefined
        suppressClick.current = true
      }
      return
    }
    if (drag.current?.id !== event.pointerId) return
    suppressClick.current = drag.current.moved
    drag.current = undefined
  }

  // One CSS pixel in map units: marks and names keep their size whatever the zoom.
  const unit = view.width / frame.width
  // Paintings show once a degree spans about 220 pixels, wherever the frame is that wide; a
  // place's own map shows only its own painting, larger, so that it stands out.
  const showPictures = !compact && 1 / unit >= 2.2
  const thumbRadius = (point: AtlasMapPoint) => (point[1] === focus?.[1] ? 26 : 17) * unit
  const hasThumb = (point: AtlasMapPoint) =>
    Boolean(point[5]) && (showPictures || point[1] === focus?.[1])
  const inView = (point: AtlasMapPoint) =>
    point[2] >= view.x - 40 * unit &&
    point[2] <= view.x + view.width + 40 * unit &&
    point[3] >= view.y - 40 * unit &&
    point[3] <= view.y + view.height + 40 * unit
  // The place of the page is drawn last, over its neighbours.
  const visible = points
    .filter(inView)
    .sort((left, right) => Number(left[1] === focus?.[1]) - Number(right[1] === focus?.[1]))

  // Names are placed from the most named place down; a name that would cover one already
  // placed is left out, and shows once the map is close enough to part them.
  const labelled = new Set<string>()
  const placed: [left: number, top: number, right: number, bottom: number, owner: string][] = []
  // Paintings are drawn first: names keep off them.
  for (const point of visible) {
    if (!hasThumb(point)) continue
    const radius = thumbRadius(point) + unit
    placed.push([
      point[2] - radius,
      point[3] - radius,
      point[2] + radius,
      point[3] + radius,
      point[1],
    ])
  }
  const byFame = [...visible].sort(
    (left, right) =>
      Number(right[1] === focus?.[1]) - Number(left[1] === focus?.[1]) || right[4] - left[4]
  )
  for (const point of byFame) {
    const [name, uniqueName, x, y] = point
    const fontSize = (uniqueName === focus?.[1] ? 14 : 12) * unit
    const width = name.length * fontSize * 0.56
    const top = y + (hasThumb(point) ? thumbRadius(point) + 13 * unit : 15 * unit) - fontSize
    const box: (typeof placed)[number] = [
      x - width / 2,
      top,
      x + width / 2,
      top + fontSize * 1.3,
      uniqueName,
    ]
    // A name sits under its own painting: only the others count.
    const covers = placed.some(
      other =>
        other[4] !== uniqueName &&
        box[0] < other[2] &&
        box[2] > other[0] &&
        box[1] < other[3] &&
        box[3] > other[1]
    )
    if (covers) continue
    placed.push(box)
    labelled.add(uniqueName)
  }

  return (
    <div className={`atlas-map ${compact ? 'atlas-map--compact' : ''}`}>
      <div
        ref={frameRef}
        className="atlas-map__frame"
        role="group"
        aria-label={messages.mapLabel}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={event => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <svg
          className="atlas-map__svg"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <rect
            className="atlas-map__sea"
            x={-ATLAS_MAP_WIDTH}
            y={-ATLAS_MAP_HEIGHT}
            width={ATLAS_MAP_WIDTH * 3}
            height={ATLAS_MAP_HEIGHT * 3}
          />
          <use href="/atlas/map.svg#land" className="atlas-map__land" />
          <use href="/atlas/map.svg#lakes" className="atlas-map__lakes" />
          <use
            href="/atlas/map.svg#rivers"
            className="atlas-map__rivers"
            style={{ strokeWidth: 1.4 * unit }}
          />
          {visible.map((point, index) => {
            const [name, uniqueName, x, y, chapters, picture] = point
            const focused = focus?.[1] === uniqueName
            const named = labelled.has(uniqueName)
            const thumb = hasThumb(point)
            const thumbSize = thumbRadius(point)
            const radius = (focused ? 7 : picture ? 5 : chapters >= 20 ? 4 : 3) * unit
            return (
              <a
                key={uniqueName}
                href={buildAtlasEntityPath(language, uniqueName)}
                className={`atlas-map__place ${focused ? 'is-focus' : ''} ${picture ? 'is-painted' : ''}`}
                aria-label={name}
              >
                {thumb ? (
                  <>
                    <clipPath id={`${clipPrefix}-${index}`}>
                      <circle cx={x} cy={y} r={thumbSize} />
                    </clipPath>
                    <circle className="atlas-map__ring" cx={x} cy={y} r={thumbSize + 1.5 * unit} />
                    <image
                      href={picture}
                      x={x - thumbSize}
                      y={y - thumbSize}
                      width={thumbSize * 2}
                      height={thumbSize * 2}
                      clipPath={`url(#${clipPrefix}-${index})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <circle
                    className="atlas-map__dot"
                    cx={x}
                    cy={y}
                    r={radius}
                    strokeWidth={1.5 * unit}
                  />
                )}
                {named && (
                  <text
                    className="atlas-map__name"
                    x={x}
                    y={y + (thumb ? thumbSize + 13 * unit : 15 * unit)}
                    fontSize={(focused ? 14 : 12) * unit}
                    strokeWidth={3 * unit}
                  >
                    {name}
                  </text>
                )}
              </a>
            )
          })}
        </svg>
      </div>
      <div className="atlas-map__controls">
        <button type="button" onClick={() => zoomAt(0.6)} aria-label={messages.mapZoomIn}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button type="button" onClick={() => zoomAt(1 / 0.6)} aria-label={messages.mapZoomOut}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {!compact && (
          <>
            <button
              type="button"
              className="atlas-map__text-button"
              onClick={() => {
                touched.current = true
                setView(fit(ATLAS_HOLY_LAND_VIEW, aspect))
              }}
            >
              {messages.mapHoly}
            </button>
            <button
              type="button"
              className="atlas-map__text-button"
              onClick={() => {
                touched.current = true
                setView(clampView(fit(ATLAS_WHOLE_VIEW, aspect), aspect))
              }}
            >
              {messages.mapReset}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
