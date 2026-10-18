// Keeps the page while the visitor travels between worlds (docs/adr/0085): a veil grows from the
// portal, the next world loads underneath, the address changes, and the veil opens on arrival.
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { haptic } from './haptics'
import { loadLanguage } from './language'
import {
  universeAt,
  universes,
  type Arrival,
  type ScreenPoint,
  type UniverseId,
  type UniverseProps,
} from './universes'
import './universe-travel.css'

type WorldModule = { default: ComponentType<UniverseProps> }
const imports: Record<UniverseId, () => Promise<WorldModule>> = {
  archipelago: () => import('./ArchipelagoApp'),
  'valence-1876': () => import('./valence/ValenceApp'),
}
const worlds = {
  archipelago: lazy(imports.archipelago),
  'valence-1876': lazy(imports['valence-1876']),
} satisfies Record<UniverseId, ComponentType<UniverseProps>>

export const COVER_MS = 750
export const UNCOVER_MS = 900
/** Long enough to read where the journey leads, even when the next world is already cached. */
const MIN_COVERED_MS = 1100
/** A world that never reports is uncovered anyway, with its own loading or error screen. */
const READY_TIMEOUT_MS = 20_000

type Phase = 'covering' | 'covered' | 'uncovering'
type Journey = { from: UniverseId; to: UniverseId; origin: ScreenPoint; phase: Phase; push: boolean }
type Visit = { id: UniverseId; arrival: Arrival | null; count: number }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const center = (): ScreenPoint => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
/** The radius that covers the whole screen from `point`. */
const cover = ({ x, y }: ScreenPoint) =>
  Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))) + 2

export function UniverseHost({ initial }: { initial: UniverseId }) {
  const [visit, setVisit] = useState<Visit>({ id: initial, arrival: null, count: 0 })
  const [journey, setJourney] = useState<Journey | null>(null)
  const visitRef = useRef(visit)
  const journeyRef = useRef(journey)
  visitRef.current = visit
  journeyRef.current = journey
  const coveredAt = useRef(0)
  const readyCount = useRef(-1)

  const travel = useCallback((to: UniverseId, origin?: ScreenPoint, push = true) => {
    if (journeyRef.current || to === visitRef.current.id) return
    // Fetch the destination while the veil covers the screen.
    void imports[to]().catch(() => undefined)
    haptic('select')
    const next: Journey = { from: visitRef.current.id, to, origin: origin ?? center(), phase: 'covering', push }
    journeyRef.current = next
    setJourney(next)
  }, [])

  const uncover = useCallback(() => {
    const current = journeyRef.current
    if (!current || current.phase !== 'covered') return
    const next = { ...current, phase: 'uncovering' as const }
    journeyRef.current = next
    setJourney(next)
  }, [])

  // The world of this visit is drawn: open the veil once it has been read.
  const onReady = useCallback(() => {
    const count = visitRef.current.count
    if (readyCount.current === count) return
    readyCount.current = count
    if (journeyRef.current?.phase !== 'covered') return
    setTimeout(uncover, Math.max(0, MIN_COVERED_MS - (performance.now() - coveredAt.current)))
  }, [uncover])

  const onTravel = useCallback((to: UniverseId, origin?: ScreenPoint) => travel(to, origin), [travel])
  const done = useCallback(() => {
    journeyRef.current = null
    setJourney(null)
  }, [])

  // Covered: switch worlds underneath. The previous world unmounts and destroys its game.
  const arrive = useCallback(() => {
    const current = journeyRef.current
    if (!current || current.phase !== 'covering') return
    if (current.push)
      history.pushState({ universe: current.to }, '', `${universes[current.to].path}${location.search}`)
    coveredAt.current = performance.now()
    const next = { ...current, phase: 'covered' as const }
    journeyRef.current = next
    setJourney(next)
    setVisit(old => ({ id: current.to, arrival: { from: current.from }, count: old.count + 1 }))
    setTimeout(() => {
      if (journeyRef.current === next) uncover()
    }, READY_TIMEOUT_MS)
  }, [uncover])

  // The Back and Forward buttons travel too, without adding to the history.
  useEffect(() => {
    const pop = () => travel(universeAt(location.pathname), undefined, false)
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [travel])

  const World = worlds[visit.id]
  return (
    <>
      <WorldBoundary key={visit.count} onError={onReady}>
        <Suspense fallback={null}>
          <World key={visit.count} arrival={visit.arrival} onTravel={onTravel} onReady={onReady} />
        </Suspense>
      </WorldBoundary>
      {journey && (
        <TravelVeil journey={journey} onCovered={arrive} onDone={done} />
      )}
    </>
  )
}

function TravelVeil({
  journey,
  onCovered,
  onDone,
}: {
  journey: Journey
  onCovered: () => void
  onDone: () => void
}) {
  const veil = useRef<HTMLDivElement>(null)
  const language = useState(loadLanguage)[0]
  const destination = universes[journey.to]

  // The top layer keeps the veil above any dialog the world left open.
  useEffect(() => {
    const element = veil.current
    try {
      element?.showPopover()
    } catch {
      // Without the Popover API the veil still covers the page from its fixed layer.
    }
  }, [])

  useEffect(() => {
    const element = veil.current
    if (!element || journey.phase === 'covered') return
    const covering = journey.phase === 'covering'
    // Arrivals open on the screen's centre, where the camera holds the visitor.
    const point = covering ? journey.origin : center()
    const at = `at ${Math.round(point.x)}px ${Math.round(point.y)}px`
    const frames = reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${cover(point)}px ${at})` }]
    const animation = element.animate(covering ? frames : [...frames].reverse(), {
      duration: covering ? COVER_MS : UNCOVER_MS,
      easing: covering ? 'cubic-bezier(0.7, 0, 0.84, 0)' : 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards',
    })
    animation.onfinish = covering ? onCovered : onDone
    return () => {
      animation.onfinish = null
    }
  }, [journey.phase, journey.origin, onCovered, onDone])

  return (
    <div
      ref={veil}
      className="travel-veil"
      popover="manual"
      data-to={journey.to}
      data-phase={journey.phase}
      role="status"
      aria-live="polite"
    >
      <p className="travel-name">{destination.name[language]}</p>
      <p className="travel-line">{destination.travel[language]}</p>
      <span className="travel-progress" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}

/** A world whose code cannot load (offline, new deployment) falls back to a full page load. */
class WorldBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    if (!this.state.failed) return this.props.children
    const french = loadLanguage() === 'fr'
    return (
      <main className="travel-failed">
        <p>{french ? 'Ce monde n’a pas pu se charger.' : 'This world could not load.'}</p>
        <button type="button" onClick={() => location.reload()}>
          {french ? 'Recharger' : 'Reload'}
        </button>
      </main>
    )
  }
}
