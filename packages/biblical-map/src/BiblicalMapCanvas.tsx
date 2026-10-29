import {
  BIBLICAL_MAP_HEIGHT,
  BIBLICAL_MAP_HOLY_LAND,
  BIBLICAL_MAP_MIN_WIDTH,
  BIBLICAL_MAP_WHOLE,
  BIBLICAL_MAP_WIDTH,
  clampBiblicalMapView,
  fitBiblicalMapView,
  placeBiblicalMapLabels,
  type BiblicalMapPlace,
  type BiblicalMapView,
} from '@bible-strong/resource-domain/biblical-map'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'

// The map of the places of the Bible as a web page draws it (ADR-0091): the atlas of the public
// site, and the map screen of the application in a DOM component. The view is redrawn on every
// move, which a browser does within a frame; names and marks keep their size whatever the zoom.

/** A finger that moves less than this many pixels taps. */
const MOVE_TOLERANCE = 4
/** A place is touched within this many pixels of its mark. */
const HIT_RADIUS = 12
/** Paintings show once a degree spans about 220 pixels. */
const PICTURES_FROM = 2.2
/** How much speed a glide keeps per millisecond, as a scroll view slows on iOS. */
const GLIDE_DECAY = 0.998
/** Below this speed, in pixels per millisecond, a lifted finger leaves the map where it is. */
const GLIDE_FROM = 0.12
const GLIDE_UNTIL = 0.015
/** A zoom from the buttons or a double tap eases to its view over this many milliseconds. */
const EASE_DURATION = 260

export type BiblicalMapColors = {
  sea: string
  land: string
  coast: string
  water: string
  /** A place without a painting. */
  place: string
  /** The place in focus, the places brought forward, a place under the pointer. */
  accent: string
  /** Around marks and paintings. */
  halo: string
  ink: string
  /** Around names, to keep them readable over rivers and coasts. */
  nameHalo: string
  control: string
  controlInk: string
  controlLine: string
  /** Opacity of lakes and rivers: the application draws them in a lighter primary colour. */
  lakeOpacity?: number
  riverOpacity?: number
}

export type BiblicalMapLabels = {
  map: string
  zoomIn: string
  zoomOut: string
  /** Back to the Promised Land; no button without it. */
  holyLand?: string
  whole: string
}

type Props = {
  places: readonly BiblicalMapPlace[]
  /** The place the map is about: marked, named first, its painting always shown. */
  focus?: string
  /** Places brought forward, the others dimmed: the places of a chapter. */
  highlighted?: readonly string[]
  /** The region the map opens on; the Promised Land by default. */
  region?: BiblicalMapView
  /** A small map on a place's page: only the painting of the place in focus. */
  compact?: boolean
  colors: BiblicalMapColors
  labels: BiblicalMapLabels
  /** Land, lakes and rivers: the site uses its cached `map.svg`, the application draws them. */
  renderGround: (unit: number) => ReactNode
  /** Places are links to their page… */
  placeHref?: (uniqueName: string) => string
  /** …or open it themselves. */
  onOpenPlace?: (uniqueName: string) => void
  /** The map takes the size of its root, which the page sets. */
  className?: string
  style?: CSSProperties
}

type Drag = { x: number; y: number; view: BiblicalMapView; moved: boolean; id: number }
type Sample = { time: number; x: number; y: number }

export default function BiblicalMapCanvas({
  places,
  focus,
  highlighted,
  region,
  compact = false,
  colors,
  labels,
  renderGround,
  placeHref,
  onOpenPlace,
  className,
  style,
}: Props) {
  // Clip paths are named by position: a unique name may hold characters an address cannot.
  const clipPrefix = `biblical-map${useId().replace(/[^a-z0-9]/giu, '')}`
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: compact ? 640 : 1200, height: compact ? 360 : 640 })
  const aspect = frame.height / frame.width
  const opening = region ?? BIBLICAL_MAP_HOLY_LAND
  const openingKey = `${opening.x}:${opening.y}:${opening.width}:${opening.height}`
  const openAt = (ratio: number) => clampBiblicalMapView(fitBiblicalMapView(opening, ratio), ratio)
  const [view, setView] = useState<BiblicalMapView>(() => openAt(aspect))
  // The view the next frame draws: a glide reads it between renders.
  const viewRef = useRef(view)
  viewRef.current = view
  const frameSize = useRef(frame)
  frameSize.current = frame
  const show = (next: BiblicalMapView) => {
    viewRef.current = next
    setView(next)
  }

  // Until the reader moves the map, a new frame size or region opens it again on its region.
  const touched = useRef(false)
  const openingRef = useRef(openAt)
  openingRef.current = openAt
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      setFrame({ width, height })
      show(
        touched.current
          ? clampBiblicalMapView(
              { ...viewRef.current, height: viewRef.current.width * (height / width) },
              height / width
            )
          : openingRef.current(height / width)
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const openedOn = useRef(openingKey)
  useEffect(() => {
    if (openedOn.current === openingKey) return
    openedOn.current = openingKey
    touched.current = false
    show(openingRef.current(frameSize.current.height / frameSize.current.width))
  }, [openingKey])

  // One animation at a time: a glide after a drag, or a zoom easing to its view.
  const animation = useRef<number | undefined>(undefined)
  const stop = () => {
    if (animation.current !== undefined) cancelAnimationFrame(animation.current)
    animation.current = undefined
  }
  useEffect(() => stop, [])

  const glide = (speedX: number, speedY: number) => {
    stop()
    let last: number | undefined
    let velocityX = speedX
    let velocityY = speedY
    const step = (now: number) => {
      const elapsed = last === undefined ? 16 : Math.min(now - last, 40)
      last = now
      const decay = GLIDE_DECAY ** elapsed
      velocityX *= decay
      velocityY *= decay
      if (Math.hypot(velocityX, velocityY) < GLIDE_UNTIL) {
        animation.current = undefined
        return
      }
      const current = viewRef.current
      const scale = current.width / frameSize.current.width
      const wanted = {
        ...current,
        x: current.x - velocityX * elapsed * scale,
        y: current.y - velocityY * elapsed * scale,
      }
      const next = clampBiblicalMapView(wanted, frameSize.current.height / frameSize.current.width)
      // An edge of the map stops the glide along it.
      if (next.x !== wanted.x) velocityX = 0
      if (next.y !== wanted.y) velocityY = 0
      show(next)
      animation.current = requestAnimationFrame(step)
    }
    animation.current = requestAnimationFrame(step)
  }

  const easeTo = (target: BiblicalMapView) => {
    stop()
    touched.current = true
    const from = viewRef.current
    let start: number | undefined
    const step = (now: number) => {
      start ??= now
      const progress = Math.min((now - start) / EASE_DURATION, 1)
      const eased = 1 - (1 - progress) ** 3
      // The width eases in proportion, as a zoom feels even, and the window moves with it.
      const width = from.width * (target.width / from.width) ** eased
      const weight =
        target.width === from.width ? eased : (width - from.width) / (target.width - from.width)
      show({
        x: from.x + (target.x - from.x) * weight,
        y: from.y + (target.y - from.y) * weight,
        width,
        height: width * (frameSize.current.height / frameSize.current.width),
      })
      animation.current = progress < 1 ? requestAnimationFrame(step) : undefined
    }
    animation.current = requestAnimationFrame(step)
  }

  /** The view zoomed by a factor around a point of the frame, as fractions of its size. */
  const zoomedAt = (factor: number, px = 0.5, py = 0.5) => {
    const current = viewRef.current
    const width = Math.min(
      Math.max(current.width * factor, BIBLICAL_MAP_MIN_WIDTH),
      BIBLICAL_MAP_WIDTH
    )
    const height = width * aspect
    return clampBiblicalMapView(
      {
        x: current.x + (current.width - width) * px,
        y: current.y + (current.height - height) * py,
        width,
        height,
      },
      aspect
    )
  }
  const pointIn = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect()
    return rect
      ? { px: (clientX - rect.left) / rect.width, py: (clientY - rect.top) / rect.height }
      : { px: 0.5, py: 0.5 }
  }

  // The wheel and Safari's own pinch zoom the map, not the page: React listens passively.
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const prevent = (event: Event) => event.preventDefault()
    element.addEventListener('wheel', prevent, { passive: false })
    element.addEventListener('gesturestart', prevent, { passive: false })
    element.addEventListener('gesturechange', prevent, { passive: false })
    return () => {
      element.removeEventListener('wheel', prevent)
      element.removeEventListener('gesturestart', prevent)
      element.removeEventListener('gesturechange', prevent)
    }
  }, [])

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    stop()
    touched.current = true
    const { px, py } = pointIn(event.clientX, event.clientY)
    show(zoomedAt(Math.exp(event.deltaY * 0.0016), px, py))
  }

  const drag = useRef<Drag | undefined>(undefined)
  const samples = useRef<Sample[]>([])
  const suppressClick = useRef(false)
  // Two fingers on the map pinch it: the distance between them sets the zoom, their middle
  // stays under them.
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; x: number; y: number; view: BiblicalMapView }>(undefined)
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
    // A finger on a gliding map holds it where it is.
    stop()
    // A pinch makes no click: what it left to suppress belongs to it, not to the next tap.
    if (fingers.current.size === 0) suppressClick.current = false
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const both = spread()
    if (both) {
      drag.current = undefined
      pinch.current = { ...both, view: viewRef.current }
      touched.current = true
      return
    }
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      view: viewRef.current,
      moved: false,
      id: event.pointerId,
    }
    samples.current = [{ time: event.timeStamp, x: event.clientX, y: event.clientY }]
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
        Math.max((start.width * pinch.current.distance) / both.distance, BIBLICAL_MAP_MIN_WIDTH),
        BIBLICAL_MAP_WIDTH
      )
      // The map point that was under the fingers' middle stays under it, wherever it moves.
      const fromX = start.x + ((pinch.current.x - rect.left) / rect.width) * start.width
      const fromY = start.y + ((pinch.current.y - rect.top) / rect.height) * start.height
      show(
        clampBiblicalMapView(
          {
            x: fromX - ((both.x - rect.left) / rect.width) * width,
            y: fromY - ((both.y - rect.top) / rect.height) * width * aspect,
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
    samples.current.push({ time: event.timeStamp, x: event.clientX, y: event.clientY })
    if (samples.current.length > 8) samples.current.shift()
    const scale = current.view.width / frame.width
    show(
      clampBiblicalMapView(
        { ...current.view, x: current.view.x - dx * scale, y: current.view.y - dy * scale },
        aspect
      )
    )
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(event.pointerId)
    if (pinch.current) {
      // The pinch ends with its first lifted finger; the click it would make is not a tap. The
      // finger left on the map carries on as a drag.
      if (fingers.current.size < 2) {
        pinch.current = undefined
        suppressClick.current = true
        const [rest] = [...fingers.current.entries()]
        drag.current = rest
          ? { x: rest[1].x, y: rest[1].y, view: viewRef.current, moved: true, id: rest[0] }
          : undefined
        samples.current = []
      }
      return
    }
    const current = drag.current
    if (current?.id !== event.pointerId) return
    suppressClick.current = current.moved
    drag.current = undefined
    if (event.type === 'pointercancel') return
    if (!current.moved) {
      // A tap opens the place under it. The web view of iOS sends no click to an SVG element
      // without a link, so the tap is read from the finger itself.
      const place = (event.target as Element).closest?.('[data-place]')
      const uniqueName = place?.getAttribute('data-place')
      if (uniqueName && !placeHref) onOpenPlace?.(uniqueName)
      return
    }
    // The speed of the last tenth of a second carries the map on.
    const recent = samples.current.filter(sample => event.timeStamp - sample.time < 100)
    const first = recent[0]
    const last = recent[recent.length - 1]
    if (!first || !last || last.time - first.time < 8) return
    const speedX = (last.x - first.x) / (last.time - first.time)
    const speedY = (last.y - first.y) / (last.time - first.time)
    if (Math.hypot(speedX, speedY) >= GLIDE_FROM) glide(speedX, speedY)
  }

  // One pixel in map units: marks and names keep their size whatever the zoom.
  const unit = view.width / frame.width
  const bright = useMemo(() => new Set(highlighted ?? []), [highlighted])
  // A place's own small map shows only its own painting, larger, so that it stands out.
  const showPictures = !compact && 1 / unit >= PICTURES_FROM
  const thumbRadius = (place: BiblicalMapPlace) =>
    place.picture && (place.uniqueName === focus || showPictures)
      ? place.uniqueName === focus
        ? 26
        : 17
      : undefined
  // Only the places in the window, with a margin; the place in focus and the places brought
  // forward are drawn last, over their neighbours.
  const visible = places
    .filter(
      place =>
        place.x >= view.x - 40 * unit &&
        place.x <= view.x + view.width + 40 * unit &&
        place.y >= view.y - 40 * unit &&
        place.y <= view.y + view.height + 40 * unit
    )
    .sort(
      (left, right) =>
        Number(left.uniqueName === focus) - Number(right.uniqueName === focus) ||
        Number(bright.has(left.uniqueName)) - Number(bright.has(right.uniqueName))
    )
  const labelled = placeBiblicalMapLabels({
    // Places brought forward are named first, as the place in focus is.
    places: bright.size
      ? visible.map(place =>
          bright.has(place.uniqueName)
            ? { ...place, chapterCount: place.chapterCount + 10_000 }
            : place
        )
      : visible,
    unit,
    focus,
    thumbRadius,
  })

  const palette = {
    '--biblical-map-sea': colors.sea,
    '--biblical-map-land': colors.land,
    '--biblical-map-coast': colors.coast,
    '--biblical-map-water': colors.water,
    '--biblical-map-place': colors.place,
    '--biblical-map-accent': colors.accent,
    '--biblical-map-halo': colors.halo,
    '--biblical-map-ink': colors.ink,
    '--biblical-map-name-halo': colors.nameHalo,
    '--biblical-map-control': colors.control,
    '--biblical-map-control-ink': colors.controlInk,
    '--biblical-map-control-line': colors.controlLine,
    '--biblical-map-lake-opacity': colors.lakeOpacity ?? 1,
    '--biblical-map-river-opacity': colors.riverOpacity ?? 1,
  } as CSSProperties

  return (
    <div className={`biblical-map ${className ?? ''}`} style={{ ...palette, ...style }}>
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />
      <div
        ref={frameRef}
        className="biblical-map__frame"
        role="group"
        aria-label={labels.map}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={event => {
          const { px, py } = pointIn(event.clientX, event.clientY)
          easeTo(zoomedAt(0.5, px, py))
        }}
        onClickCapture={event => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <svg
          className="biblical-map__svg"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <rect
            className="biblical-map__sea"
            x={-BIBLICAL_MAP_WIDTH}
            y={-BIBLICAL_MAP_HEIGHT}
            width={BIBLICAL_MAP_WIDTH * 3}
            height={BIBLICAL_MAP_HEIGHT * 3}
          />
          {renderGround(unit)}
          {visible.map((place, index) => {
            const { name, uniqueName, x, y, picture } = place
            const focused = uniqueName === focus
            const brought = bright.has(uniqueName)
            const thumb = thumbRadius(place)
            const radius =
              (focused ? 7 : brought ? 5.5 : picture ? 5 : place.chapterCount >= 20 ? 4 : 3) * unit
            const classes = [
              'biblical-map__place',
              focused || brought ? 'is-accent' : '',
              bright.size && !brought && !focused ? 'is-dimmed' : '',
            ].join(' ')
            const content = (
              <>
                <circle
                  className="biblical-map__hit"
                  cx={x}
                  cy={y}
                  r={Math.max(thumb ?? 0, HIT_RADIUS) * unit}
                />
                {thumb !== undefined ? (
                  <>
                    <clipPath id={`${clipPrefix}-${index}`}>
                      <circle cx={x} cy={y} r={thumb * unit} />
                    </clipPath>
                    <circle className="biblical-map__ring" cx={x} cy={y} r={(thumb + 1.5) * unit} />
                    <image
                      href={picture}
                      x={x - thumb * unit}
                      y={y - thumb * unit}
                      width={thumb * 2 * unit}
                      height={thumb * 2 * unit}
                      clipPath={`url(#${clipPrefix}-${index})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <circle
                    className="biblical-map__dot"
                    cx={x}
                    cy={y}
                    r={radius}
                    strokeWidth={1.5 * unit}
                  />
                )}
                {labelled.has(uniqueName) && (
                  <text
                    className="biblical-map__name"
                    x={x}
                    y={y + (thumb !== undefined ? thumb + 13 : 15) * unit}
                    fontSize={(focused ? 14 : 12) * unit}
                    strokeWidth={3 * unit}
                  >
                    {name}
                  </text>
                )}
              </>
            )
            return placeHref ? (
              <a
                key={uniqueName}
                href={placeHref(uniqueName)}
                className={classes}
                aria-label={name}
              >
                {content}
              </a>
            ) : (
              <g
                key={uniqueName}
                className={classes}
                role="button"
                aria-label={name}
                data-place={uniqueName}
              >
                {content}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="biblical-map__controls">
        <button type="button" onClick={() => easeTo(zoomedAt(0.5))} aria-label={labels.zoomIn}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button type="button" onClick={() => easeTo(zoomedAt(2))} aria-label={labels.zoomOut}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {!compact && (
          <>
            {labels.holyLand && (
              <button
                type="button"
                className="biblical-map__text-button"
                onClick={() =>
                  easeTo(
                    clampBiblicalMapView(fitBiblicalMapView(BIBLICAL_MAP_HOLY_LAND, aspect), aspect)
                  )
                }
              >
                {labels.holyLand}
              </button>
            )}
            <button
              type="button"
              className="biblical-map__text-button"
              onClick={() =>
                easeTo(clampBiblicalMapView(fitBiblicalMapView(BIBLICAL_MAP_WHOLE, aspect), aspect))
              }
            >
              {labels.whole}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const MAP_CSS = `
.biblical-map { position: relative; }
.biblical-map__frame {
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: var(--biblical-map-sea);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.biblical-map__frame:active { cursor: grabbing; }
.biblical-map__svg { display: block; width: 100%; height: 100%; }
.biblical-map__sea { fill: var(--biblical-map-sea); }
.biblical-map__land {
  fill: var(--biblical-map-land);
  stroke: var(--biblical-map-coast);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}
.biblical-map__lakes { fill: var(--biblical-map-water); fill-opacity: var(--biblical-map-lake-opacity); }
.biblical-map__rivers {
  fill: none;
  stroke: var(--biblical-map-water);
  stroke-opacity: var(--biblical-map-river-opacity);
}
.biblical-map__place { cursor: pointer; outline: none; }
.biblical-map__place.is-dimmed { opacity: 0.35; }
.biblical-map__hit { fill: transparent; }
.biblical-map__dot { fill: var(--biblical-map-place); stroke: var(--biblical-map-halo); }
.biblical-map__ring { fill: var(--biblical-map-halo); }
.biblical-map__place.is-accent .biblical-map__ring,
.biblical-map__place.is-accent .biblical-map__dot,
.biblical-map__place:focus-visible .biblical-map__dot { fill: var(--biblical-map-accent); }
@media (hover: hover) {
  .biblical-map__place:hover .biblical-map__dot { fill: var(--biblical-map-accent); }
}
.biblical-map__name {
  fill: var(--biblical-map-ink);
  stroke: var(--biblical-map-name-halo);
  stroke-linejoin: round;
  paint-order: stroke;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}
.biblical-map__controls {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.biblical-map__controls button {
  display: inline-flex;
  min-width: 40px;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--biblical-map-control-line);
  border-radius: 999px;
  background: var(--biblical-map-control);
  color: var(--biblical-map-control-ink);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.biblical-map__controls svg { width: 16px; height: 16px; }
.biblical-map__controls .biblical-map__text-button { padding: 0 14px; font-size: 0.85rem; font-weight: 600; }
`
