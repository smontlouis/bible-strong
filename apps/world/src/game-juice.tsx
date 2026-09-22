import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import './game-juice.css'

/* Presentation-only "juice": screen transitions, particles, counters and shakes.
   Nothing here awards points or changes game state; the room stays authoritative. */

export function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Flips a parity every time `key` changes so CSS enter animations restart without
 * remounting the screen (inputs keep focus and the mobile keyboard stays open). */
export function useScreenTransition(key: string) {
  const [seen, setSeen] = useState(key)
  const [state, setState] = useState({ parity: 0, count: 0 })
  if (seen !== key) {
    setSeen(key)
    setState(s => ({ parity: s.parity ^ 1, count: s.count + 1 }))
  }
  return state
}

/** True for `ms` after `trigger` changes (never on first render). */
export function useTransient(trigger: unknown, ms: number, enabled = true) {
  const first = useRef(true)
  // Read through a ref so re-renders that only change `enabled` never cancel a running timer.
  const allowed = useRef(enabled)
  allowed.current = enabled
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!allowed.current) {
      setActive(false)
      return
    }
    setActive(true)
    const timer = setTimeout(() => setActive(false), ms)
    return () => clearTimeout(timer)
  }, [trigger, ms])
  return active
}

/** Remembers the previous render value of `value`. */
export function usePrevious<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

function random(seed: number) {
  // Small deterministic generator so a burst keyed by seed is stable across re-renders.
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function hash(value: string | number) {
  const text = String(value)
  let h = 7
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

const STAR_PATH =
  'M12 3.2l2.75 5.7 6.25.85-4.55 4.4 1.15 6.2L12 17.4l-5.6 2.95 1.15-6.2L3 9.75l6.25-.85z'

/** Five-point star drawn inline so it looks the same on every device.
 * Colour comes from CSS: `--star-fill`, `--star-edge`, `--star-shine`. */
export function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`star-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 26"
      aria-hidden="true"
      focusable="false"
    >
      <path className="star-depth" d={STAR_PATH} transform="translate(0 2.2)" />
      <path className="star-body" d={STAR_PATH} />
      <path
        className="star-shine"
        d="M9 8.9c.9-1.7 2.1-2.8 3.3-3.3-.5 1.5-1.4 2.8-2.7 3.7-.5.3-.8.1-.6-.4z"
      />
    </svg>
  )
}

/** Four-point sparkle used by bursts and loaders. */
export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={`sparkle-icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 1c.6 6.2 4.8 10.4 11 11-6.2.6-10.4 4.8-11 11-.6-6.2-4.8-10.4-11-11 6.2-.6 10.4-4.8 11-11z" />
    </svg>
  )
}

/** Radial burst of sparks around the centre of its positioned parent. */
export function Burst({
  seed,
  count = 18,
  kind = 'stars',
  spread = 90,
}: {
  seed: string | number
  count?: number
  kind?: 'stars' | 'confetti' | 'dots'
  spread?: number
}) {
  const pieces = useMemo(() => {
    const next = random(hash(seed))
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (next() - 0.5) * 0.6
      const distance = spread * (0.55 + next() * 0.75)
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - spread * 0.2,
        rot: Math.round((next() - 0.5) * 540),
        delay: Math.round(next() * 90),
        size: 8 + Math.round(next() * 10),
        hue: i % 5,
      }
    })
  }, [seed, count, spread])
  if (reducedMotion()) return null
  return (
    <span className="juice-burst" data-kind={kind} aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          data-hue={p.hue}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--delay': `${p.delay}ms`,
              '--size': `${p.size}px`,
            } as CSSProperties
          }
        >
          {kind === 'stars' ? <SparkleIcon /> : null}
        </i>
      ))}
    </span>
  )
}

/** Confetti rain over the whole viewport (the dialog lives in the top layer). */
export function Confetti({ seed, count = 70 }: { seed: string | number; count?: number }) {
  const pieces = useMemo(() => {
    const next = random(hash(seed))
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round(next() * 100),
      delay: Math.round(next() * 700),
      duration: 2200 + Math.round(next() * 1400),
      rot: Math.round(next() * 720),
      sway: Math.round((next() - 0.5) * 120),
      w: 6 + Math.round(next() * 8),
      h: 8 + Math.round(next() * 10),
      hue: i % 5,
      shape: i % 3,
    }))
  }, [seed, count])
  if (reducedMotion()) return null
  return (
    <div className="juice-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          data-hue={p.hue}
          data-shape={p.shape}
          style={
            {
              '--x': `${p.x}vw`,
              '--delay': `${p.delay}ms`,
              '--duration': `${p.duration}ms`,
              '--rot': `${p.rot}deg`,
              '--sway': `${p.sway}px`,
              '--w': `${p.w}px`,
              '--h': `${p.h}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function dialogRect(anchor: RefObject<HTMLElement | null>) {
  const dialog = anchor.current?.closest('dialog') ?? anchor.current
  return dialog?.getBoundingClientRect() ?? null
}

/** Coloured wipe that covers the dialog for a beat when the screen changes. */
export function Curtain({
  token,
  label,
  anchor,
  tone = 'blue',
}: {
  token: number
  label?: ReactNode
  anchor: RefObject<HTMLElement | null>
  tone?: 'blue' | 'yellow' | 'navy'
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [shown, setShown] = useState(0)
  useLayoutEffect(() => {
    if (token === 0 || reducedMotion()) return
    setRect(dialogRect(anchor))
    setShown(token)
    const timer = setTimeout(() => setShown(0), 620)
    return () => clearTimeout(timer)
  }, [token, anchor])
  if (!shown || !rect) return null
  return (
    <div
      key={shown}
      className="juice-curtain-clip"
      aria-hidden="true"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      <div className="juice-curtain" data-tone={tone}>
        {label && <strong>{label}</strong>}
      </div>
    </div>
  )
}

/** "Go!" is the last 620 ms before the server opens the first question. */
export const GO_MS = 620

/** Whether a game opening at `startsAt` is still inside its 3 · 2 · 1 · Go! window. */
export function inCountdown(phase: string, round: number, startsAt: number | undefined, now: number) {
  if (round !== 0) return false
  if (phase === 'generating') return true
  return phase === 'question' && startsAt !== undefined && now < startsAt
}

/** Countdown cadence, `remaining` ms before the question opens: which step to show and
 * how long until the next change. `done` once the question is open. */
export function countdownStep(remaining: number, last: number) {
  if (remaining <= 0) return { done: true as const }
  if (remaining <= GO_MS) return { done: false as const, index: last, wait: remaining }
  const counting = remaining - GO_MS
  const seconds = Math.ceil(counting / 1000)
  return {
    done: false as const,
    index: Math.max(0, last - seconds),
    wait: counting - (seconds - 1) * 1000,
  }
}

/** 3 · 2 · 1 · Go! screen synced to the server: "Go!" ends exactly when the first question
 * opens (`until`), each number is the second before it. Without `until` (still preparing)
 * it holds the first number. */
export function Countdown({
  anchor,
  steps,
  until,
  now,
  paused = false,
  screen = false,
  children,
  onTick,
  onDone,
}: {
  anchor: RefObject<HTMLElement | null>
  /** Numbers then the final "Go!" label. */
  steps: string[]
  /** Server time when the question opens; undefined while the catalogue prepares it. */
  until: number | undefined
  /** Current server time, used to derive this page's clock offset. */
  now: number
  paused?: boolean
  /** Render as a full screen inside the dialog instead of a fixed overlay. */
  screen?: boolean
  children?: ReactNode
  onTick?: (index: number) => void
  onDone: () => void
}) {
  const last = steps.length - 1
  // `now` is sampled about once a second, so it lags the real server clock; the largest
  // offset observed is the closest one and must never move the count backwards.
  const offset = useRef(now - Date.now())
  offset.current = Math.max(offset.current, now - Date.now())
  const done = useRef(onDone)
  done.current = onDone
  const compute = () => {
    if (until === undefined) return 0
    const step = countdownStep(until - (Date.now() + offset.current), last)
    return step.done ? last : step.index
  }
  const [index, setIndex] = useState(compute)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    if (!screen) setRect(dialogRect(anchor))
  }, [anchor, screen])
  useEffect(() => {
    onTick?.(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])
  useEffect(() => {
    if (paused || until === undefined) {
      setIndex(compute())
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      const next = countdownStep(until - (Date.now() + offset.current), last)
      if (next.done) {
        // The question is open (or a late timer caught up): never hold it back further.
        done.current()
        return
      }
      setIndex(next.index)
      timer = setTimeout(step, Math.max(16, next.wait + 8))
    }
    step()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until, paused])
  return (
    <div
      className={screen ? 'juice-countdown juice-countdown-screen' : 'juice-countdown'}
      data-final={index === last}
      data-waiting={until === undefined || paused}
      style={
        rect && !screen
          ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          : {}
      }
    >
      <strong key={index} role="status" aria-live="assertive">
        {steps[index]}
      </strong>
      {children}
    </div>
  )
}

/** Sends a "+N" flying from one element to another, then bumps the target. */
export function flyTo(from: HTMLElement | null, to: HTMLElement | null, text: string) {
  if (!from || !to || reducedMotion()) return
  const host = from.closest('dialog') ?? document.body
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const piece = document.createElement('b')
  piece.className = 'juice-fly'
  piece.textContent = text
  piece.style.left = `${a.left + a.width / 2}px`
  piece.style.top = `${a.top + a.height / 2}px`
  host.append(piece)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const flight = piece.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 46}px)) scale(1.35)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.55)`, opacity: 0.9 },
    ],
    { duration: 720, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' }
  )
  flight.onfinish = () => {
    piece.remove()
    to.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.6)', offset: 0.35 },
        { transform: 'scale(0.92)', offset: 0.7 },
        { transform: 'scale(1)' },
      ],
      { duration: 420, easing: 'ease-out' }
    )
  }
  // A closed dialog must not leak the piece.
  setTimeout(() => piece.remove(), 1500)
}

/** Number that counts up with a punch when it grows. */
export function PunchNumber({
  value,
  from,
  duration = 550,
  delay = 0,
}: {
  value: number
  from?: number
  duration?: number
  delay?: number
}) {
  const previous = useRef(from ?? value)
  const [shown, setShown] = useState(from ?? value)
  const bump = useTransient(value, 420, value > previous.current)
  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (value <= from || reducedMotion() || document.visibilityState === 'hidden') {
      // Hidden tabs never run animation frames; show the final value straight away.
      setShown(value)
      return
    }
    let frame = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, delay])
  return (
    <span className="juice-number" data-bump={bump} aria-label={String(value)}>
      <span aria-hidden="true">{shown}</span>
    </span>
  )
}
