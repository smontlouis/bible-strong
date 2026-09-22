import { currentActivity } from './avatar-activity'
import { ReactionIcon, ReactionPicker } from './ReactionPicker'
import { StarIcon } from './game-juice'
import { WorldLoading } from './WorldLoading'
import { StoryDialog } from './StoryDialog'
import { BibleGames } from './BibleGames'
import { ExplorationJournal, JournalIcon, journalCopy } from './ExplorationJournal'
import { findTravelDestination } from './world-travel'
import { islandActions, nearIslandAction, type IslandActionId } from './island-actions'
import { GuestbookDialog } from './GuestbookDialog'
import { createAmbientEditor, ambientKinds } from './ambient-zones'
import { AmbientEditorPanel, EditorNavigation, editorCopy, type EditorMode } from './WorldEditor'
import { createShoreEditor } from './shorelines'
import { ShoreEditor } from './ShoreEditor'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import nipplejs from 'nipplejs'
import { clampCameraZoom } from './camera-zoom'
import { ARRIVAL_FADE_MS, MINIMUM_LOADING_MS } from './world-arrival'
import { ControlIcon } from './ControlIcon'
import { installButtonHaptics } from './haptics'
import { Modal } from './Modal'
import { DiscoveryBoundary } from './DiscoveryBoundary'
import { createWorld, type Controls, type WorldState } from './game'
import { defaultNavigation, SPAWN, stations, type Station } from './world'
import { loadNavigation, navigationFingerprint } from './navigation-document'
import { useCameraZoomGestures } from './use-camera-zoom-gestures'
import { diagnosticCategories, diagnosticCopy, makeDiagnosticFilters } from './diagnostic-filters'
const DictionaryDiscovery = lazy(() =>
  import('./DictionaryDiscovery').then(module => ({ default: module.DictionaryDiscovery }))
)
const LexiconDiscovery = lazy(() =>
  import('./LexiconDiscovery').then(module => ({ default: module.LexiconDiscovery }))
)
const ReferencesDiscovery = lazy(() =>
  import('./ReferencesDiscovery').then(module => ({ default: module.ReferencesDiscovery }))
)
const ThemesDiscovery = lazy(() =>
  import('./ThemesDiscovery').then(module => ({ default: module.ThemesDiscovery }))
)
const ComparisonsDiscovery = lazy(() =>
  import('./ComparisonsDiscovery').then(module => ({ default: module.ComparisonsDiscovery }))
)
const CommentariesDiscovery = lazy(() =>
  import('./CommentariesDiscovery').then(module => ({ default: module.CommentariesDiscovery }))
)
import { AvatarEditor, profileCopy } from './AvatarEditor'
import { AVATAR_COLORS, generateExplorerProfile, loadProfile, saveProfile } from './avatar-profile'
import { loadVisitedPlaces, saveVisitedPlaces } from './visited-places'
import { loadLanguage, saveLanguage } from './language'
import './style.css'
const GuestbookAdmin = lazy(() => import('./GuestbookAdmin'))
const ZoneEditor = import.meta.env.DEV ? lazy(() => import('./ZoneEditor')) : () => null

const copy = {
  fr: {
    camera: 'Caméra',
    online: 'dans le monde',
    connecting: 'Connexion au monde…',
    offline: 'Reconnexion… Tu peux continuer à explorer.',
    full: 'Le monde est complet pour le moment.',
    retry: 'Réessayer',
    title: 'Un monde à explorer',
    brand: 'Bible Strong',
    hint: 'Déplace ton avatar avec le joystick.',
    home: 'Retour à la place',
    overview: 'Vue d’ensemble',
    follow: 'Suivre mon avatar',
    explore: 'Découvrir',
    close: 'Fermer',
    joystick: 'Joystick de déplacement',
    here: 'Place de la Bible',
    prototype: 'Prototype · ASI Europe',
    loading: 'Préparation de ton voyage…',
    visit: 'Approche-toi des lieux pour les découvrir.',
    keyboard: 'Flèches / ZQSD / WASD',
    debug: 'Diagnostic',
    edit: 'Éditer les zones',
    draftError: 'Fichier de navigation du projet illisible : carte initiale chargée.',
    intro:
      'Un premier aperçu de cette ressource. Les démonstrations de Bible Strong seront ajoutées dans une prochaine étape.',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    choose: 'Choisir mon avatar',
    walked: 'lieux visités',
  },
  en: {
    camera: 'Camera',
    online: 'in the world',
    connecting: 'Connecting to the world…',
    offline: 'Reconnecting… You can keep exploring.',
    full: 'The world is full at the moment.',
    retry: 'Try again',
    title: 'A world to explore',
    brand: 'Bible Strong',
    hint: 'Move your avatar with the joystick.',
    home: 'Back to the plaza',
    overview: 'World overview',
    follow: 'Follow my avatar',
    explore: 'Discover',
    close: 'Close',
    joystick: 'Movement joystick',
    here: 'Bible plaza',
    prototype: 'Prototype · ASI Europe',
    loading: 'Preparing your journey…',
    visit: 'Approach each place to discover it.',
    keyboard: 'Arrow keys / WASD / ZQSD',
    debug: 'Diagnostics',
    edit: 'Edit zones',
    draftError: 'Cannot read the project navigation file: original map loaded.',
    intro:
      'A first look at this resource. Bible Strong demonstrations will be added in a future step.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    choose: 'Choose my avatar',
    walked: 'places visited',
  },
}
type Language = keyof typeof copy
const DEFAULT_NAVIGATION_FINGERPRINT = navigationFingerprint(defaultNavigation)

function CameraControls({
  controls,
  overview,
  setOverview,
  labels,
}: {
  controls: Controls
  overview: boolean
  setOverview: (value: boolean | ((current: boolean) => boolean)) => void
  labels: Pick<
    (typeof copy)['fr'],
    'camera' | 'follow' | 'home' | 'overview' | 'zoomIn' | 'zoomOut'
  >
}) {
  return (
    <nav className="camera-controls" aria-label={labels.camera}>
      <button
        onClick={() => setOverview(value => !value)}
        title={overview ? labels.follow : labels.overview}
        aria-label={overview ? labels.follow : labels.overview}
        aria-pressed={overview}
      >
        <ControlIcon name={overview ? 'follow' : 'overview'} />
      </button>
      <button
        title={labels.zoomIn}
        aria-label={labels.zoomIn}
        onClick={() => {
          controls.zoom = clampCameraZoom(
            (overview ? controls.minimumZoom : controls.zoom) + 0.2,
            controls.minimumZoom
          )
          setOverview(false)
        }}
      >
        <ControlIcon name="plus" />
      </button>
      <button
        title={labels.zoomOut}
        aria-label={labels.zoomOut}
        onClick={() => {
          controls.zoom = clampCameraZoom(
            (overview ? controls.minimumZoom : controls.zoom) - 0.2,
            controls.minimumZoom
          )
          setOverview(false)
        }}
      >
        <ControlIcon name="minus" />
      </button>
      <button
        title={labels.home}
        aria-label={labels.home}
        onClick={() => {
          controls.reset++
          setOverview(false)
        }}
      >
        <ControlIcon name="reset" />
      </button>
    </nav>
  )
}

function App() {
  const [savedProfile] = useState(loadProfile)
  const [profile, setProfile] = useState(() => savedProfile ?? generateExplorerProfile())
  const [onboarding, setOnboarding] = useState(!savedProfile)
  const [profileOpen, setProfileOpen] = useState(!savedProfile)
  const [menuOpen, setMenuOpen] = useState(false)
  const [travelError, setTravelError] = useState(false)
  const [profileStorageError, setProfileStorageError] = useState(false)
  const [initial, setInitial] = useState(() => ({
    document: structuredClone(defaultNavigation),
    error: false,
  }))
  const [navigation, setNavigation] = useState(initial.document)
  const [navigationLoaded, setNavigationLoaded] = useState(false)
  const savedNavigation = useRef(DEFAULT_NAVIGATION_FINGERPRINT)
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null)
  const editing = editorMode === 'navigation'
  const [ambientEditor] = useState(createAmbientEditor)
  const [shoreEditor] = useState(createShoreEditor)
  const shoreEditing = editorMode === 'shorelines'
  const host = useRef<HTMLDivElement>(null)
  const joystick = useRef<HTMLDivElement>(null)
  const controls = useRef<Controls>({
    shoreEditor,
    ambientEditor,
    discoveryActions: {},
    navigation: initial.document,
    direction: { x: 0, y: 0 },
    avatar: profile.avatar,
    avatarColor: profile.color,
    avatarName: profile.name,
    paused: true,
    arrivalStartedAt: null,
    overview: false,
    debug: false,
    zoom: window.matchMedia('(hover: none) and (pointer: coarse)').matches ? 1.75 : 2,
    minimumZoom: 0,
    reset: 0,
  })
  const [state, setState] = useState<WorldState>({
    ...SPAWN,
    cameraZoom: 1,
    station: null,
    behind: [],
    moving: false,
    fps: 0,
  })
  const [loadingColor] = useState(
    () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  )
  const [minimumLoadingElapsed, setMinimumLoadingElapsed] = useState(false)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [overview, setOverview] = useState(false)
  const [debug, setDebug] = useState(
    () => import.meta.env.DEV && new URLSearchParams(location.search).has('debug')
  )
  const [diagnosticFilters, setDiagnosticFilters] = useState(() => makeDiagnosticFilters())
  const [language, setLanguage] = useState<Language>(loadLanguage)
  const [storyOpen, setStoryOpen] = useState(false)
  const [guestbookOpen, setGuestbookOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [gamesMode, setGamesMode] = useState<'solo' | 'together' | null>(null)
  const [reactionRequest, setReactionRequest] = useState(0)
  const atGuestbook = nearIslandAction(state, 'guestbook', navigation)
  const [opened, setOpened] = useState<WorldState['station']>(null)
  const [visited, setVisited] = useState(loadVisitedPlaces)
  useEffect(() => {
    saveVisitedPlaces(visited)
  }, [visited])
  const t = copy[language]
  const name = (station: (typeof stations)[number]) =>
    language === 'fr' ? station.name : station[language]

  useCameraZoomGestures(host, controls, setOverview)

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadNavigation(), shoreEditor.load(), ambientEditor.load()]).then(
      ([result]) => {
        if (cancelled) return
        setInitial(result)
        setNavigation(result.document)
        savedNavigation.current = navigationFingerprint(result.document)
        setNavigationLoaded(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!navigationLoaded) return
    const game = createWorld(
      host.current!,
      controls.current,
      setState,
      () => setSceneLoaded(true),
      () => setFailed(true)
    )
    return () => game.destroy(true)
  }, [navigationLoaded])

  useEffect(() => {
    const timer = setTimeout(() => setMinimumLoadingElapsed(true), MINIMUM_LOADING_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!sceneLoaded || !minimumLoadingElapsed || failed) return
    controls.current.arrivalStartedAt = performance.now()
    setRevealing(true)
  }, [sceneLoaded, minimumLoadingElapsed, failed])

  useEffect(() => {
    if (!revealing || failed) return
    const finish = setTimeout(() => setReady(true), ARRIVAL_FADE_MS)
    return () => clearTimeout(finish)
  }, [revealing, failed])

  useEffect(() => {
    const stick = nipplejs.create({
      zone: joystick.current!,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      size: 112,
      color: { front: '#fff6df', back: '#163f51' },
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
    joystick.current!.addEventListener('pointercancel', stop)
    const zone = joystick.current!
    return () => {
      stick.destroy()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      zone.removeEventListener('pointercancel', stop)
      stop()
    }
  }, [])

  useEffect(() => {
    controls.current.activity = currentActivity({
      ready,
      menuOpen,
      profileOpen,
      opened,
      storyOpen,
      guestbookOpen,
      gamesOpen,
    })
    controls.current.avatar = profile.avatar
    controls.current.avatarColor = profile.color
    controls.current.avatarName = profile.name
    controls.current.overview = overview
    controls.current.debug = debug
    controls.current.diagnosticFilters = diagnosticFilters
    controls.current.paused =
      !ready ||
      menuOpen ||
      Boolean(opened) ||
      storyOpen ||
      guestbookOpen ||
      gamesOpen ||
      Boolean(editorMode) ||
      profileOpen
    controls.current.multiplayerEnabled = !editorMode
    controls.current.navigation = navigation
    controls.current.direction = { x: 0, y: 0 }
  }, [
    ready,
    profile,
    profileOpen,
    menuOpen,
    overview,
    debug,
    diagnosticFilters,
    opened,
    storyOpen,
    guestbookOpen,
    gamesOpen,
    editorMode,
    navigation,
  ])
  useEffect(() => {
    document.documentElement.lang = language
    saveLanguage(language)
    const title =
      language === 'fr'
        ? 'Bible Strong World — Explore la Bible autrement'
        : 'Bible Strong World — A new way to explore the Bible'
    const description =
      language === 'fr'
        ? 'Explore un monde interactif pour découvrir la Bible : lexiques, dictionnaire, commentaires et jeux bibliques, en solo ou avec d’autres explorateurs.'
        : 'Explore an interactive world of Bible lexicons, a dictionary, commentaries and Bible games. Discover Scripture on your own or with other explorers.'
    document.title = title
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
      document.querySelector(selector)?.setAttribute('content', title)
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ])
      document.querySelector(selector)?.setAttribute('content', description)
    document
      .querySelector('meta[property="og:locale"]')
      ?.setAttribute('content', language === 'fr' ? 'fr_FR' : 'en_US')
    document
      .querySelector('meta[property="og:locale:alternate"]')
      ?.setAttribute('content', language === 'fr' ? 'en_US' : 'fr_FR')
  }, [language])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        navigationFingerprint(navigation) !== savedNavigation.current ||
        shoreEditor.dirty ||
        ambientEditor.dirty
      ) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [navigation])

  function switchEditor(mode: EditorMode | null) {
    if (!import.meta.env.DEV) return
    shoreEditor.editing = mode === 'shorelines'
    shoreEditor.paused = false
    ambientEditor.editing = mode !== null && mode !== 'navigation' && mode !== 'shorelines'
    if (ambientEditor.editing && mode && ambientKinds.includes(mode as typeof ambientEditor.kind)) {
      ambientEditor.kind = mode as typeof ambientEditor.kind
      if (!ambientEditor.zones.some(z => z.id === ambientEditor.selected && z.kind === mode)) {
        ambientEditor.selected = ambientEditor.zones.find(z => z.kind === mode)?.id ?? ''
      }
      ambientEditor.focus++
      ambientEditor.mode = 'select'
      ambientEditor.notify()
    }
    controls.current.paused =
      Boolean(mode) ||
      menuOpen ||
      Boolean(opened) ||
      storyOpen ||
      guestbookOpen ||
      gamesOpen ||
      profileOpen
    controls.current.direction = { x: 0, y: 0 }
    setEditorMode(mode)
  }

  function discover(id: IslandActionId) {
    if (!ready || controls.current.paused) return
    if (id === 'story' && nearIslandAction(state, id, navigation)) {
      controls.current.paused = true
      controls.current.direction = { x: 0, y: 0 }
      setStoryOpen(true)
      return
    }
    if (id === 'games' && nearIslandAction(state, id, navigation)) {
      controls.current.paused = true
      controls.current.direction = { x: 0, y: 0 }
      setGamesMode('solo')
      setGamesOpen(true)
      return
    }
    if (id === 'guestbook' && atGuestbook) {
      controls.current.paused = true
      controls.current.direction = { x: 0, y: 0 }
      setGuestbookOpen(true)
      return
    }
    if (!nearIslandAction(state, id, navigation) || !state.station) return
    controls.current.paused = true
    controls.current.direction = { x: 0, y: 0 }
    setOpened(state.station)
    setVisited(old => (old.includes(state.station!.id) ? old : [...old, state.station!.id]))
  }

  function travel(station: Station) {
    const destination = findTravelDestination(station, navigation)
    if (!destination) {
      setTravelError(true)
      return
    }
    controls.current.travelTo = destination
    controls.current.direction = { x: 0, y: 0 }
    setOverview(false)
    setMenuOpen(false)
  }

  return (
    <main
      className={`world-shell ${!ready ? 'is-loading' : ''} ${editing ? 'is-editing' : ''} ${editorMode ? 'is-world-editing' : ''}`}
    >
      <div className="world-canvas" ref={host} aria-label="Bible Strong — archipel" />
      <header className="world-header">
        <button
          className="journal-trigger"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          disabled={!ready || Boolean(editorMode)}
          onClick={() => {
            controls.current.paused = true
            controls.current.direction = { x: 0, y: 0 }
            setTravelError(false)
            setMenuOpen(true)
          }}
        >
          <JournalIcon />
          {journalCopy[language].menu}
        </button>
      </header>
      {!ready && (
        <WorldLoading
          language={language}
          color={loadingColor}
          revealing={revealing}
          failed={failed}
        />
      )}
      <div
        ref={element => {
          controls.current.contactActions = element
          // The scene toggles `disabled` itself; React must not own that attribute, or its
          // event delegation keeps treating the buttons as disabled. Prime it once only:
          // this callback runs on every render and would otherwise re-disable them.
          if (element && !element.dataset.primed) {
            element.dataset.primed = 'true'
            element.querySelectorAll('button').forEach(button => (button.disabled = true))
          }
        }}
        className="contact-actions"
        data-visible="false"
        aria-hidden="true"
      >
        <button
          type="button"
          className="contact-action"
          aria-label={language === 'fr' ? 'Proposer une partie' : 'Invite to play'}
          aria-haspopup="dialog"
          onClick={() => {
            if (!ready || controls.current.paused) return
            controls.current.paused = true
            controls.current.direction = { x: 0, y: 0 }
            setGamesMode('together')
            setGamesOpen(true)
          }}
        >
          <StarIcon />
        </button>
        <button
          type="button"
          className="contact-action"
          aria-label={language === 'fr' ? 'Envoyer une réaction' : 'Send a reaction'}
          onClick={() => setReactionRequest(n => n + 1)}
        >
          <ReactionIcon reaction="hello" color={profile.color} />
        </button>
      </div>
      {islandActions.map(action => {
        const station = stations.find(station => station.id === action.id)
        const label =
          action.id === 'story'
            ? 'Bible Strong x ASI Europe'
            : action.id === 'games'
              ? language === 'fr'
                ? 'Jouer · Solo ou ensemble'
                : 'Play · Solo or together'
              : action.id === 'guestbook'
                ? language === 'fr'
                  ? 'Ouvrir le tableau des petits mots'
                  : 'Open the community board'
                : `${t.explore} · ${station ? name(station) : ''}`
        return (
          <button
            key={action.id}
            type="button"
            ref={element => {
              controls.current.discoveryActions![action.id] = element
            }}
            className="discover-button"
            data-island={action.id}
            disabled={
              !ready ||
              !nearIslandAction(state, action.id, navigation) ||
              Boolean(opened) ||
              storyOpen ||
              guestbookOpen ||
              Boolean(editorMode) ||
              profileOpen ||
              menuOpen
            }
            aria-label={label}
            aria-haspopup="dialog"
            onClick={() => discover(action.id)}
          >
            <ControlIcon
              name={
                action.id === 'story'
                  ? 'book'
                  : action.id === 'games'
                    ? 'star'
                    : action.id === 'guestbook'
                      ? 'edit'
                      : 'search'
              }
            />
          </button>
        )
      })}
      <aside className="world-bottom">
        <div className="joystick-zone" ref={joystick} role="group" aria-label={t.joystick} />
        <div className="companion-controls">
          {ready && profile.name && !editorMode && (
            <div
              className="world-presence"
              data-state={state.multiplayer?.state ?? 'connecting'}
              role="status"
              aria-live="polite"
            >
              <span className="presence-dot" aria-hidden="true" />
              <span>
                {state.multiplayer?.state === 'online'
                  ? `${state.multiplayer.count} ${t.online}`
                  : t[state.multiplayer?.state ?? 'connecting']}
              </span>
              {state.multiplayer?.state === 'full' && (
                <button onClick={() => controls.current.retryMultiplayer?.()}>{t.retry}</button>
              )}
            </div>
          )}
        </div>
      </aside>
      <div className="world-action-stack">
        {ready &&
          !editorMode &&
          !editing &&
          !menuOpen &&
          !profileOpen &&
          !opened &&
          !guestbookOpen &&
          !storyOpen &&
          !gamesOpen && (
            <ReactionPicker
              network={controls.current.network}
              color={profile.color}
              language={language}
              online={state.multiplayer?.state === 'online'}
              openRequest={reactionRequest}
            />
          )}
        {ready && !editorMode && controls.current.network && (
          <BibleGames
            network={controls.current.network}
            language={language}
            open={gamesOpen}
            preferredMode={gamesMode}
            onOpen={() => {
              setGamesMode(null)
              setGamesOpen(true)
            }}
            onClose={() => {
              setGamesMode(null)
              setGamesOpen(false)
            }}
            disabled={menuOpen || profileOpen || !!opened || guestbookOpen || storyOpen}
          />
        )}
      </div>
      <footer className="world-footer">
        {initial.error && <span title={t.draftError}>{t.draftError}</span>}
        {import.meta.env.DEV && (
          <div className="footer-actions">
            <button
              disabled={!ready || !navigationLoaded}
              onClick={() => switchEditor('shorelines')}
            >
              {editorCopy[language].open}
            </button>
            <button onClick={() => setDebug(v => !v)} aria-pressed={debug}>
              {t.debug}
            </button>
          </div>
        )}
      </footer>
      {import.meta.env.DEV && debug && (
        <fieldset className="diagnostic-filters">
          <legend>{diagnosticCopy[language].title}</legend>
          <div className="diagnostic-filter-actions">
            <button type="button" onClick={() => setDiagnosticFilters(makeDiagnosticFilters())}>
              {diagnosticCopy[language].all}
            </button>
            <button
              type="button"
              onClick={() => setDiagnosticFilters(makeDiagnosticFilters(false))}
            >
              {diagnosticCopy[language].none}
            </button>
          </div>
          <div className="diagnostic-filter-options">
            {diagnosticCategories.map(category => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={diagnosticFilters[category]}
                  onChange={event =>
                    setDiagnosticFilters(previous => ({
                      ...previous,
                      [category]: event.target.checked,
                    }))
                  }
                />
                {diagnosticCopy[language][category]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {import.meta.env.DEV && (
        <output
          className={`world-debug ${debug ? '' : 'sr-only'}`}
          data-testid="world-state"
          data-x={state.x.toFixed(1)}
          data-y={state.y.toFixed(1)}
          data-moving={state.moving}
          data-behind={state.behind.join(',')}
          data-camera-zoom={state.cameraZoom.toFixed(3)}
        >
          x {state.x.toFixed(0)} · y {state.y.toFixed(0)} · {state.fps} fps
          <br />
          {state.behind.join(' / ') || '—'}
        </output>
      )}
      {menuOpen && (
        <ExplorationJournal
          language={language}
          onLanguage={setLanguage}
          profile={profile}
          onAvatar={() => setProfileOpen(true)}
          visited={visited}
          onTravel={travel}
          onStory={() => {
            setMenuOpen(false)
            setStoryOpen(true)
          }}
          onGames={() => {
            setMenuOpen(false)
            setGamesMode(null)
            setGamesOpen(true)
          }}
          onBoard={() => {
            setMenuOpen(false)
            setGuestbookOpen(true)
          }}
          onClose={() => setMenuOpen(false)}
          travelError={travelError}
          camera={
            <CameraControls
              controls={controls.current}
              overview={overview}
              setOverview={setOverview}
              labels={t}
            />
          }
          status={
            <>
              {profileStorageError && (
                <span className="profile-storage-error" role="status">
                  {profileCopy[language].storage}
                </span>
              )}
            </>
          }
        />
      )}
      {ready && profileOpen && (
        <AvatarEditor
          profile={profile}
          onboarding={onboarding}
          language={language}
          onClose={() => {
            if (!onboarding) setProfileOpen(false)
          }}
          onSave={next => {
            setProfileStorageError(!saveProfile(next))
            setProfile(next)
            setOnboarding(false)
            setProfileOpen(false)
          }}
        />
      )}
      {storyOpen && (
        <StoryDialog
          language={language}
          onClose={() => setStoryOpen(false)}
          onBoard={() => {
            setStoryOpen(false)
            setGuestbookOpen(true)
          }}
        />
      )}
      {guestbookOpen && (
        <GuestbookDialog
          language={language}
          profile={profile}
          onClose={() => setGuestbookOpen(false)}
        />
      )}
      <DiscoveryBoundary
        key={opened?.id ?? 'closed'}
        language={language}
        onClose={() => setOpened(null)}
      >
        <Suspense
          fallback={
            opened ? (
              <Modal
                labelledBy="discovery-loading"
                closeLabel={t.close}
                onClose={() => setOpened(null)}
              >
                <p id="discovery-loading" role="status">
                  {language === 'fr' ? 'Chargement…' : 'Loading…'}
                </p>
              </Modal>
            ) : null
          }
        >
          {opened?.id === 'lexicon' && (
            <LexiconDiscovery language={language} onClose={() => setOpened(null)} />
          )}
          {opened?.id === 'dictionary' && (
            <DictionaryDiscovery language={language} onClose={() => setOpened(null)} />
          )}
          {opened?.id === 'references' && (
            <ReferencesDiscovery language={language} onClose={() => setOpened(null)} />
          )}
          {opened?.id === 'themes' && (
            <ThemesDiscovery language={language} onClose={() => setOpened(null)} />
          )}
          {opened?.id === 'comparison' && (
            <ComparisonsDiscovery language={language} onClose={() => setOpened(null)} />
          )}
          {opened?.id === 'commentaries' && (
            <CommentariesDiscovery language={language} onClose={() => setOpened(null)} />
          )}
        </Suspense>
      </DiscoveryBoundary>
      {import.meta.env.DEV && editorMode && (
        <EditorNavigation
          mode={editorMode}
          language={language}
          onMode={switchEditor}
          onClose={() => switchEditor(null)}
        />
      )}
      {import.meta.env.DEV && ambientEditor.editing && (
        <AmbientEditorPanel
          model={ambientEditor}
          language={language}
          onZoom={factor => {
            controls.current.shoreZoom = factor
          }}
        />
      )}
      {import.meta.env.DEV && shoreEditing && (
        <ShoreEditor
          model={shoreEditor}
          language={language}
          onZoom={factor => {
            controls.current.shoreZoom = factor
          }}
          onClose={() => switchEditor(null)}
        />
      )}
      {import.meta.env.DEV && editing && (
        <Suspense fallback={<div className="zone-editor">{t.loading}</div>}>
          <ZoneEditor
            initial={navigation}
            initialSavedFingerprint={savedNavigation.current}
            onDraft={setNavigation}
            language={language}
            onSave={next => {
              savedNavigation.current = navigationFingerprint(next)
              setNavigation(next)
            }}
            onTest={next => {
              setNavigation(next)
              switchEditor(null)
              setDebug(true)
            }}
          />
        </Suspense>
      )}
    </main>
  )
}

const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (!import.meta.hot?.data.haptics) installButtonHaptics()
if (import.meta.hot) import.meta.hot.data.haptics = true
if (import.meta.hot) import.meta.hot.data.root = root
root.render(
  ['/admin', '/admin/', '/admin-guestbook'].includes(location.pathname) ? (
    <Suspense fallback={<p>…</p>}>
      <GuestbookAdmin />
    </Suspense>
  ) : (
    <App />
  )
)
