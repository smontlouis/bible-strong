import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AvatarPreview } from './AvatarEditor'
import type { GuestbookEntry } from './guestbook'
import {
  constrainCamera,
  minimumZoom,
  noteLines,
  placeNote,
  wallBounds,
  type WallCamera,
} from './guestbook-layout'

export function GuestbookWall({
  entries,
  language,
  focusId,
}: {
  entries: GuestbookEntry[]
  language: 'fr' | 'en'
  focusId?: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [camera, setCamera] = useState<WallCamera>({ x: 0, y: 0, zoom: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const fitted = useRef(false)
  const focused = useRef<string | undefined>(undefined)
  const notes = useMemo(() => {
    const result: (GuestbookEntry & { placement: NonNullable<GuestbookEntry['placement']> })[] = []
    for (const entry of [...entries].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
    )) {
      result.push({
        ...entry,
        placement:
          entry.placement ??
          placeNote(
            entry.id,
            entry.message,
            result.map(note => note.placement)
          ),
      })
    }
    return result
  }, [entries])
  const bounds = useMemo(() => wallBounds(notes.map(note => note.placement)), [notes])
  const minZoom = minimumZoom(bounds, size.width, size.height)
  const view = constrainCamera(camera, bounds, size.width, size.height)
  const t =
    language === 'fr'
      ? {
          label: 'Mur des petits mots',
          hint: 'Glisse pour explorer · Pince pour zoomer',
          out: 'Dézoomer',
          in: 'Zoomer',
          fit: 'Voir tout le mur',
        }
      : {
          label: 'Visitor note wall',
          hint: 'Drag to explore · Pinch to zoom',
          out: 'Zoom out',
          in: 'Zoom in',
          fit: 'See the whole wall',
        }
  useEffect(() => {
    const element = viewport.current!
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (size.width <= 1 || !notes.length) return
    if (focusId && focused.current !== focusId) {
      const note = notes.find(note => note.id === focusId)
      if (note) {
        viewport.current?.focus()
        focused.current = focusId
        fitted.current = true
        setCamera({
          x: note.placement.x,
          y: note.placement.y,
          zoom: Math.min(
            1,
            (size.width - 48) / note.placement.width,
            (size.height - 80) / note.placement.height
          ),
        })
      }
    } else if (!fitted.current) {
      fitted.current = true
      setCamera({
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2,
        zoom: minZoom,
      })
    }
  }, [notes, focusId, size, bounds, minZoom])
  useEffect(() => {
    const element = viewport.current!
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const px = event.clientX - rect.left - size.width / 2
      const py = event.clientY - rect.top - size.height / 2
      setCamera(previous => {
        const current = constrainCamera(previous, bounds, size.width, size.height)
        const delta =
          event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1)
        const zoom = Math.max(minZoom, Math.min(2, current.zoom * Math.exp(-delta * 0.002)))
        return constrainCamera(
          {
            zoom,
            x: current.x + px / current.zoom - px / zoom,
            y: current.y + py / current.zoom - py / zoom,
          },
          bounds,
          size.width,
          size.height
        )
      })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [bounds, size, minZoom])
  function zoomBy(factor: number) {
    setCamera(previous => {
      const current = constrainCamera(previous, bounds, size.width, size.height)
      return constrainCamera(
        { ...current, zoom: current.zoom * factor },
        bounds,
        size.width,
        size.height
      )
    })
  }
  return (
    <div className="guestbook-wall-shell">
      <div
        className="guestbook-wall"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={t.label}
        aria-describedby="guestbook-wall-hint"
        onKeyDown={event => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-60, 0],
            ArrowRight: [60, 0],
            ArrowUp: [0, -60],
            ArrowDown: [0, 60],
          }
          if (moves[event.key]) {
            event.preventDefault()
            const [x, y] = moves[event.key]
            setCamera(
              constrainCamera(
                { ...view, x: view.x + x / view.zoom, y: view.y + y / view.zoom },
                bounds,
                size.width,
                size.height
              )
            )
          } else if (event.key === '+' || event.key === '-' || event.key === '=') {
            event.preventDefault()
            zoomBy(event.key === '-' ? 1 / 1.25 : 1.25)
          }
        }}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }}
        onPointerMove={event => {
          if (!pointers.current.has(event.pointerId)) return
          const before = [...pointers.current.values()]
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const after = [...pointers.current.values()]
          const centre = (points: typeof before) => ({
            x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
          })
          const old = centre(before),
            next = centre(after)
          const distance = (points: typeof before) =>
            Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
          const factor = before.length === 2 ? distance(after) / Math.max(1, distance(before)) : 1
          const rect = event.currentTarget.getBoundingClientRect()
          setCamera(previous => {
            const current = constrainCamera(previous, bounds, size.width, size.height)
            const zoom = Math.max(minZoom, Math.min(2, current.zoom * factor))
            return constrainCamera(
              {
                zoom,
                x:
                  current.x +
                  (old.x - rect.left - size.width / 2) / current.zoom -
                  (next.x - rect.left - size.width / 2) / zoom,
                y:
                  current.y +
                  (old.y - rect.top - size.height / 2) / current.zoom -
                  (next.y - rect.top - size.height / 2) / zoom,
              },
              bounds,
              size.width,
              size.height
            )
          })
        }}
        onPointerUp={event => pointers.current.delete(event.pointerId)}
        onPointerCancel={event => pointers.current.delete(event.pointerId)}
        onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      >
        <div
          className="guestbook-wall-plane"
          style={{
            transform: `translate(${size.width / 2 - view.x * view.zoom}px, ${size.height / 2 - view.y * view.zoom}px) scale(${view.zoom})`,
          }}
        >
          {notes.map(entry => (
            <article
              key={entry.id}
              className="guestbook-note"
              data-color={entry.noteColor ?? 'butter'}
              data-new={entry.id === focusId}
              style={
                {
                  left: entry.placement.x,
                  top: entry.placement.y,
                  width: entry.placement.width,
                  minHeight: entry.placement.height,
                  '--rotation': `${entry.placement.rotation}deg`,
                } as CSSProperties
              }
            >
              <span className="guestbook-tape" aria-hidden="true" />
              <p>{noteLines(entry.message).join('\n')}</p>
              <footer>
                <AvatarPreview avatar={entry.profile.avatar} color={entry.profile.color} />
                <strong>{entry.profile.name}</strong>
              </footer>
            </article>
          ))}
        </div>
      </div>
      <div className="guestbook-wall-tools">
        <button
          type="button"
          aria-label={t.out}
          disabled={view.zoom <= minZoom + 0.00001}
          onClick={() => zoomBy(1 / 1.25)}
        >
          −
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button
          type="button"
          aria-label={t.in}
          disabled={view.zoom >= 2}
          onClick={() => zoomBy(1.25)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={t.fit}
          onClick={() =>
            setCamera({
              x: (bounds.left + bounds.right) / 2,
              y: (bounds.top + bounds.bottom) / 2,
              zoom: minZoom,
            })
          }
        >
          ⤢
        </button>
      </div>
      <p id="guestbook-wall-hint" className="guestbook-wall-hint">
        {t.hint}
      </p>
    </div>
  )
}
