// What every world's React application shares around its Phaser scene (docs/adr/0085): the
// scene's life from loading to the arrival zoom and the journey's ready signal, the joystick, the
// explorer's profile, the language and the presence line. Each world keeps its own look and its
// own dialogs; see docs/create-a-world.md.
import nipplejs from 'nipplejs'
import { useEffect, useState, type RefObject } from 'react'
import { generateExplorerProfile, loadProfile, saveProfile, type AvatarProfile } from './avatar-profile'
import { loadLanguage, saveLanguage, type Language } from './language'
import type { PresenceStatus } from './multiplayer-protocol'
import { ARRIVAL_FADE_MS, MINIMUM_LOADING_MS } from './world-arrival'
import type { SceneControls, SceneState } from './world-scene'

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
    const element = zone.current!
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
