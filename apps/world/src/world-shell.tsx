// What every world's React application shares around its Phaser scene (docs/adr/0085): the
// scene's life from loading to the arrival zoom and the journey's ready signal, the joystick, the
// explorer's profile, the language and the presence line. Each world keeps its own look and its
// own dialogs; see docs/create-a-world.md.
import nipplejs from 'nipplejs'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { generateExplorerProfile, loadProfile, saveProfile, type AvatarProfile } from './avatar-profile'
import { loadLanguage, saveLanguage, type Language } from './language'
import type { PresenceStatus } from './multiplayer-protocol'
import { MAX_CAMERA_ZOOM } from './camera-zoom'
import { ARRIVAL_FADE_MS, MINIMUM_LOADING_MS } from './world-arrival'
import type { Point } from './world'
import type { SceneControls, SceneState } from './world-scene'
import './stand-shell.css'

/**
 * Creates the scene once its documents are loaded, then reveals it: a minimum loading time
 * (skipped for a traveller, who arrives under the journey's veil), the arrival zoom, and `ready`
 * once the fade is over. `onReady` tells the host the journey can end.
 */
export function useWorldScene<State extends SceneState, Controls extends SceneControls>({
  host,
  controls,
  start,
  documentsLoaded,
  arrival,
  onReady,
  initialState,
}: {
  host: RefObject<HTMLDivElement | null>
  controls: RefObject<Controls>
  start: (
    parent: HTMLElement,
    controls: Controls,
    publish: (state: State) => void,
    onReady: () => void,
    onError: () => void
  ) => { destroy: (removeCanvas: boolean) => void }
  documentsLoaded: boolean
  arrival: boolean
  onReady: () => void
  initialState: State | (() => State)
}) {
  const [state, setState] = useState<State>(initialState)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(arrival)
  const [revealing, setRevealing] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!documentsLoaded) return
    const game = start(host.current!, controls.current, setState, () => setSceneLoaded(true), () => setFailed(true))
    return () => game.destroy(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentsLoaded])
  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), MINIMUM_LOADING_MS)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!sceneLoaded || !minimumElapsed || failed) return
    controls.current.arrivalStartedAt = performance.now()
    setRevealing(true)
    const timer = setTimeout(() => setReady(true), ARRIVAL_FADE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneLoaded, minimumElapsed, failed])
  useEffect(() => {
    if (revealing || failed) onReady()
  }, [revealing, failed, onReady])

  return { state, ready, revealing, failed, fail: () => setFailed(true) }
}

/** The on-screen joystick, in the world's colours. */
export function useJoystick(
  zone: RefObject<HTMLDivElement | null>,
  controls: RefObject<SceneControls>,
  color: { front: string; back: string }
) {
  useEffect(() => {
    // A stand screen has no avatar, hence no joystick.
    const element = zone.current
    if (!element) return
    const stick = nipplejs.create({
      zone: element,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      size: 112,
      color,
      restOpacity: 0.85,
      fadeTime: 100,
    })
    stick.on('start', () => {
      controls.current.cancelWalk = true
    })
    stick.on('move', ({ data }) => {
      controls.current.direction = { x: data.vector.x, y: -data.vector.y }
    })
    const stop = () => {
      controls.current.direction = { x: 0, y: 0 }
    }
    stick.on('end', stop)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    element.addEventListener('pointercancel', stop)
    return () => {
      stick.destroy()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      element.removeEventListener('pointercancel', stop)
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** The explorer's avatar and name, shared by every world; a first visit opens the editor. */
export function useExplorerProfile() {
  const [saved] = useState(loadProfile)
  const [profile, setProfile] = useState<AvatarProfile>(() => saved ?? generateExplorerProfile())
  const [onboarding, setOnboarding] = useState(!saved)
  const [open, setOpen] = useState(!saved)
  const [storageError, setStorageError] = useState(false)
  return {
    profile,
    onboarding,
    open,
    setOpen,
    storageError,
    /** Closing is refused until a first profile is chosen. */
    close: () => {
      if (!onboarding) setOpen(false)
    },
    save: (next: AvatarProfile) => {
      setStorageError(!saveProfile(next))
      setProfile(next)
      setOnboarding(false)
      setOpen(false)
    },
  }
}

/** The interface language, shared by every world and kept on <html lang>. */
export function useWorldLanguage() {
  const [language, setLanguage] = useState<Language>(loadLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    saveLanguage(language)
  }, [language])
  return [language, setLanguage] as const
}

const presenceCopy = {
  fr: { full: 'Le monde est complet pour le moment.', outdated: 'Une nouvelle version du monde est disponible.', retry: 'Réessayer', reload: 'Recharger' },
  en: { full: 'The world is full at the moment.', outdated: 'A new version of the world is available.', retry: 'Try again', reload: 'Reload' },
}

/** How many explorers share the room, and what to do when it is full or outdated. */
export function WorldPresence({
  className,
  status,
  language,
  labels,
  onRetry,
}: {
  className: string
  status?: PresenceStatus
  language: Language
  /** `online` follows the count: "3 dans le monde", "3 à Valence". */
  labels: { online: string; connecting: string; offline: string }
  onRetry: () => void
}) {
  const t = presenceCopy[language]
  const state = status?.state ?? 'connecting'
  return (
    <div className={className} data-state={state} role="status" aria-live="polite">
      <span className="presence-dot" aria-hidden="true" />
      <span>
        {status?.state === 'online'
          ? `${status.count} ${labels.online}`
          : state === 'full' || state === 'outdated'
            ? t[state]
            : state === 'offline'
              ? labels.offline
              : labels.connecting}
      </span>
      {state === 'full' && (
        <button type="button" onClick={onRetry}>
          {t.retry}
        </button>
      )}
      {state === 'outdated' && (
        <button type="button" onClick={() => location.reload()}>
          {t.reload}
        </button>
      )}
    </div>
  )
}

const standCopy = {
  fr: {
    count: (count: number) => `${count} explorateur${count > 1 ? 's' : ''} en ce moment`,
    play: 'Visite automatique',
    pause: 'Mettre la visite en pause',
    resume: 'La visite reprend dans un instant',
    restart: 'Recommencer le parcours',
  },
  en: {
    count: (count: number) => `${count} explorer${count > 1 ? 's' : ''} right now`,
    play: 'Automatic tour',
    pause: 'Pause the tour',
    resume: 'The tour resumes in a moment',
    restart: 'Start the tour again',
  },
}

/** A place a stand screen's tour stops at. Without `dwell`, the world says when it is done. */
export type TourStop = { id: string; point: Point; zoom?: number; dwell?: number }
export type StandTour = ReturnType<typeof useStandTour>

const RESUME_MS = 20_000
const VISITOR_MS = 10_000
/** A breath once the camera has landed, before the place's presentation opens. */
const LANDED_PAUSE_MS = 700
/** Places are seen as close as the camera goes. */
const STOP_ZOOM = MAX_CAMERA_ZOOM

/**
 * A stand screen's automatic tour: from place to place, with a look at a real visitor in
 * between when someone is in the room. Touching the screen pauses it; it resumes after 20
 * quiet seconds, unless it was paused with its button.
 */
export function useStandTour(controls: RefObject<SceneControls>, stops: TourStop[], enabled: boolean) {
  const [paused, setPaused] = useState(false)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const [leg, setLeg] = useState<{ index: number; visitor?: string; startedAt: number }>({ index: 0, startedAt: 0 })
  const [arrived, setArrived] = useState(false)
  const [now, setNow] = useState(() => performance.now())
  const seenTouch = useRef(0)
  const lastVisitorAfter = useRef(-1)
  const playing = enabled && !paused && resumeAt === null
  const stop = stops[leg.index % stops.length]

  // Pause on touch, resume after a quiet while, and keep the waiting ring moving.
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      const t = performance.now()
      setNow(t)
      const touchedAt = controls.current.touchedAt ?? 0
      if (touchedAt > seenTouch.current) {
        seenTouch.current = touchedAt
        if (!paused) setResumeAt(touchedAt + RESUME_MS)
      }
      setResumeAt(at => (at !== null && t >= at ? null : at))
    }, 250)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused])

  const advance = useCallback(() => {
    setArrived(false)
    setLeg(current => {
      const startedAt = performance.now()
      const visitors = [...(controls.current.network?.remotes.keys() ?? [])]
      // Between two places, a moment with someone visiting from their phone.
      if (!current.visitor && visitors.length && lastVisitorAfter.current !== current.index) {
        lastVisitorAfter.current = current.index
        return { index: current.index, visitor: visitors[Math.floor(Math.random() * visitors.length)], startedAt }
      }
      return { index: current.index + 1, startedAt }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly, arrive, stay, then go on. A visitor's moment and a place with `dwell` time themselves.
  useEffect(() => {
    const c = controls.current
    if (!playing || !stop) {
      c.tour = null
      setArrived(false)
      return
    }
    c.tour = leg.visitor ? { visitor: leg.visitor, zoom: STOP_ZOOM } : { point: stop.point, zoom: stop.zoom ?? STOP_ZOOM }
    c.tourLanded = false
    const timers: ReturnType<typeof setTimeout>[] = []
    if (leg.visitor) {
      timers.push(setTimeout(advance, VISITOR_MS))
      return () => timers.forEach(clearTimeout)
    }
    // The presentation waits for the camera to land on the place, then for a breath; a place
    // with `dwell` starts counting only then.
    const landing = setInterval(() => {
      if (!c.tourLanded) return
      clearInterval(landing)
      timers.push(
        setTimeout(() => {
          setArrived(true)
          if (stop.dwell !== undefined) timers.push(setTimeout(advance, stop.dwell))
        }, LANDED_PAUSE_MS)
      )
    }, 150)
    return () => {
      clearInterval(landing)
      timers.forEach(clearTimeout)
    }
    // A world may know its places only once its map is loaded: start when they come.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, leg, stops.length])

  return {
    playing,
    paused,
    /** 0 to 1 while waiting to resume after a touch; null otherwise. */
    waiting: resumeAt === null || paused ? null : Math.min(1, Math.max(0, 1 - (resumeAt - now) / RESUME_MS)),
    /** The place being presented, once the camera is there. */
    stop: playing && arrived && !leg.visitor ? stop : null,
    /** Starts the presentation of a place again when its leg restarts. */
    legKey: `${leg.index}-${leg.startedAt}`,
    done: advance,
    /** Back to the first place, playing. */
    restart: () => {
      setPaused(false)
      setResumeAt(null)
      seenTouch.current = controls.current.touchedAt ?? 0
      lastVisitorAfter.current = -1
      setArrived(false)
      setLeg({ index: 0, startedAt: performance.now() })
    },
    /** Pauses a playing tour; plays a paused or waiting one at once: it goes on where it was. */
    toggle: () => {
      setPaused(playing)
      setResumeAt(null)
      seenTouch.current = controls.current.touchedAt ?? 0
    },
  }
}

/**
 * Everything a stand screen shows over its world, in every world (`?stand`): the world's title,
 * how many explorers are in it right now, and the world's invitation to scan its QR code. There
 * is no avatar, menu, reaction or object: the screen shows the world and the people visiting it
 * from their phones. The map stays free to drag and zoom underneath.
 */
export function StandShell({
  language,
  title,
  status,
  tour,
  presentation,
  children,
}: {
  language: Language
  title: ReactNode
  status?: PresenceStatus
  tour: StandTour
  /** What the tour shows at a place, bottom left. */
  presentation?: ReactNode
  /** The world's own invitation to scan, in its own look. */
  children: ReactNode
}) {
  const t = standCopy[language]
  const count = status?.state === 'online' ? status.count : 0
  const ring = 2 * Math.PI * 17
  return (
    <div className="stand-shell">
      <div className="stand-title">{title}</div>
      <div className="stand-corner">
        {count > 0 && (
          <p className="stand-count" role="status" aria-live="polite">
            <span className="presence-dot" aria-hidden="true" />
            {t.count(count)}
          </p>
        )}
        <button
          type="button"
          className="stand-tour"
          aria-pressed={tour.playing}
          data-waiting={tour.waiting !== null}
          title={tour.playing ? t.pause : tour.waiting !== null ? t.resume : t.play}
          onClick={tour.toggle}
        >
          <svg viewBox="0 0 40 40" aria-hidden="true">
            {tour.waiting !== null && (
              <circle className="stand-tour-ring" cx="20" cy="20" r="17" strokeDasharray={ring} strokeDashoffset={ring * (1 - tour.waiting)} />
            )}
            {tour.playing ? <path d="M15 13h3.5v14H15zm6.5 0H25v14h-3.5z" /> : <path d="M16 13v14l11-7z" />}
          </svg>
          <span>{t.play}</span>
        </button>
        <button type="button" className="stand-tour stand-restart" title={t.restart} aria-label={t.restart} onClick={tour.restart}>
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <path d="M13.5 16.5A8 8 0 1 1 12 21" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M10.5 11.5v6.5h6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {presentation && <div className="stand-presentation">{presentation}</div>}
      {children}
    </div>
  )
}

/** A place presented by the tour in a few words, for a world without dialogues. */
export function StandCaption({
  image,
  title,
  text,
  color,
  duration,
}: {
  image: string
  title: string
  text: string
  color?: string
  /** How long the tour stays, in milliseconds, shown as a filling bar. */
  duration?: number
}) {
  return (
    <section className="stand-caption" style={color ? ({ '--caption-color': color } as CSSProperties) : undefined}>
      {duration !== undefined && (
        <div className="stand-progress" aria-hidden="true">
          <span style={{ '--duration': `${duration}ms` } as CSSProperties} />
        </div>
      )}
      <img src={image} alt="" width={120} height={120} draggable={false} />
      <span>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
    </section>
  )
}
