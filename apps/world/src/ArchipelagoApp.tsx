import { currentActivity } from './avatar-activity'
import { ReactionIcon, ReactionPicker } from './ReactionPicker'
import { StarIcon } from './game-juice'
import { WorldLoading } from './WorldLoading'
import { StandBanner } from './StandBanner'
import { AppDownloadShortcut, AppDownloadStation } from './AppDownload'
import { StoryDialog } from './StoryDialog'
import { storyCopy } from './story-copy'
import { BibleGames } from './BibleGames'
import { ExplorationJournal, JournalIcon, journalCopy } from './ExplorationJournal'
import { findTravelDestination } from './world-travel'
import { islandActions, nearIslandAction, type IslandActionId } from './island-actions'
import { GuestbookDialog } from './GuestbookDialog'
import { createAmbientEditor } from './ambient-zones'
import { editorCopy, type EditorMode } from './WorldEditor'
import { createShoreEditor } from './shorelines'
import { selectEditors } from './workshop/editors'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { clampCameraZoom } from './camera-zoom'
import { ControlIcon } from './ControlIcon'
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
import { AVATAR_COLORS } from './avatar-profile'
import { loadVisitedPlaces, saveVisitedPlaces } from './visited-places'
import { StandCaption, StandShell, useExplorerProfile, useJoystick, useStandTour, useWorldLanguage, useWorldScene, WorldPresence, type TourStop } from './world-shell'
import type { UniverseProps } from './universes'
import { WORLD_PORTAL } from './world-portal'
const ArchipelagoWorkshop = import.meta.env.DEV ? lazy(() => import('./ArchipelagoWorkshop')) : () => null

const copy = {
  fr: {
    camera: 'Caméra',
    online: 'dans le monde',
    connecting: 'Connexion au monde…',
    offline: 'Reconnexion… Tu peux continuer à explorer.',
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
    prototype: 'Prototype',
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
    stand: 'Scanne pour explorer\nsur ton téléphone',
  },
  en: {
    camera: 'Camera',
    online: 'in the world',
    connecting: 'Connecting to the world…',
    offline: 'Reconnecting… You can keep exploring.',
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
    prototype: 'Prototype',
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
    stand: 'Scan to explore\non your phone',
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

/** The archipelago, the default world: six resource islands around the Bible plaza. */
export default function ArchipelagoApp({ arrival, onTravel, onReady }: UniverseProps) {
  const [stand] = useState(() => new URLSearchParams(location.search).has('stand'))
  const explorer = useExplorerProfile()
  const { profile, open: profileOpen, setOpen: setProfileOpen } = explorer
  const [menuOpen, setMenuOpen] = useState(false)
  const [travelError, setTravelError] = useState(false)
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
    stand,
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
    portalArrival: arrival ? { ...WORLD_PORTAL.arrival } : undefined,
  })
  const { state, ready, revealing, failed } = useWorldScene({
    host,
    controls,
    start: createWorld,
    documentsLoaded: navigationLoaded,
    arrival: Boolean(arrival),
    onReady,
    initialState: (): WorldState => ({ ...SPAWN, cameraZoom: 1, station: null, behind: [], moving: false, fps: 0 }),
  })
  const [loadingColor] = useState(
    () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  )
  const [overview, setOverview] = useState(false)
  const [debug, setDebug] = useState(
    () => import.meta.env.DEV && new URLSearchParams(location.search).has('debug')
  )
  const [diagnosticFilters, setDiagnosticFilters] = useState(() => makeDiagnosticFilters())
  const [language, setLanguage] = useWorldLanguage()
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
  const worldActionsVisible =
    ready &&
    !editorMode &&
    !editing &&
    !menuOpen &&
    !profileOpen &&
    !opened &&
    !guestbookOpen &&
    !storyOpen &&
    !gamesOpen
  const name = (station: (typeof stations)[number]) =>
    language === 'fr' ? station.name : station[language]

  useCameraZoomGestures(host, controls, setOverview)
  // A stand screen tours the six islands, with each one's name and what it holds.
  const standStops = useMemo(
    (): TourStop[] =>
      stations.map(station => {
        const anchor = islandActions.find(action => action.id === station.id)!
        return { id: station.id, point: { x: anchor.x, y: anchor.y }, zoom: 1.6, dwell: 9000 }
      }),
    []
  )
  const tour = useStandTour(controls, standStops, stand && ready)
  const shownIsland = tour.stop ? stations.findIndex(station => station.id === tour.stop!.id) : -1
  useJoystick(joystick, controls, { front: '#fff6df', back: '#163f51' })

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
    // A stand screen has no dialogs to wait for.
    controls.current.paused =
      !ready ||
      (!stand && profileOpen) ||
      menuOpen ||
      Boolean(opened) ||
      storyOpen ||
      guestbookOpen ||
      gamesOpen ||
      Boolean(editorMode)
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
    selectEditors(mode, shoreEditor, ambientEditor)
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

  function discover(id: IslandActionId, origin?: { x: number; y: number }) {
    if (!ready || controls.current.paused) return
    if (id === 'portal' && nearIslandAction(state, id, navigation)) {
      controls.current.paused = true
      controls.current.direction = { x: 0, y: 0 }
      onTravel(WORLD_PORTAL.to, origin)
      return
    }
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

  if (stand)
    return (
      <main className={`world-shell is-stand ${!ready ? 'is-loading' : ''}`}>
        <div className="world-canvas" ref={host} aria-label="Bible Strong — archipel" />
        {!ready && <WorldLoading language={language} color={loadingColor} revealing={revealing} failed={failed} />}
        {ready && (
          <StandShell
            language={language}
            status={state.multiplayer}
            tour={tour}
            presentation={
              shownIsland >= 0 && (
                <StandCaption
                  key={tour.legKey}
                  image={`/assets/journal/${stations[shownIsland].id}.png`}
                  title={name(stations[shownIsland])}
                  text={journalCopy[language].descriptions[shownIsland]}
                  color={stations[shownIsland].color}
                  duration={tour.stop!.dwell}
                />
              )
            }
            title={
              <p className="stand-heading">
                Bible Strong <strong>World</strong>
              </p>
            }
          >
            <StandBanner invitation={t.stand} language={language} />
          </StandShell>
        )}
      </main>
    )

  return (
    <main
      className={`world-shell ${stand ? 'is-stand' : ''} ${!ready ? 'is-loading' : ''} ${editing ? 'is-editing' : ''} ${editorMode ? 'is-world-editing' : ''}`}
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
      {!ready && (!arrival || failed) && (
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
          data-invite
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
          action.id === 'portal'
            ? language === 'fr'
              ? 'Voyager vers Valence 1876'
              : 'Travel to Valence 1876'
            : action.id === 'story'
            ? storyCopy[language].title
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
            onClick={event => {
              const box = event.currentTarget.getBoundingClientRect()
              discover(action.id, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
            }}
          >
            <ControlIcon
              name={
                action.id === 'portal'
                  ? 'portal'
                  : action.id === 'story'
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
            <WorldPresence
              className="world-presence"
              status={state.multiplayer}
              language={language}
              labels={t}
              onRetry={() => controls.current.retryMultiplayer?.()}
            />
          )}
        </div>
      </aside>
      {worldActionsVisible && (
        <AppDownloadStation
          language={language}
          ref={element => {
            controls.current.appDownloadLink = element
          }}
        />
      )}
      <div
        className="world-action-stack"
        ref={element => {
          controls.current.actionStack = element
        }}
      >
        {worldActionsVisible && (
          <ReactionPicker
            network={controls.current.network}
            color={profile.color}
            language={language}
            online={Boolean(controls.current.sendReaction)}
            onSend={reaction => controls.current.sendReaction?.(reaction) ?? false}
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
        {worldActionsVisible && !stand && <AppDownloadShortcut language={language} />}
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
              {explorer.storageError && (
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
          onboarding={explorer.onboarding}
          language={language}
          onClose={explorer.close}
          onSave={explorer.save}
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
        <Suspense fallback={<div className="zone-editor">{t.loading}</div>}>
          <ArchipelagoWorkshop
            mode={editorMode}
            onMode={switchEditor}
            language={language}
            navigation={navigation}
            savedFingerprint={savedNavigation.current}
            onDraft={setNavigation}
            onNavigation={next => {
              savedNavigation.current = navigationFingerprint(next)
              setNavigation(next)
            }}
            onTest={next => {
              setNavigation(next)
              switchEditor(null)
              setDebug(true)
            }}
            shoreEditor={shoreEditor}
            ambientEditor={ambientEditor}
            onZoom={factor => {
              controls.current.shoreZoom = factor
            }}
          />
        </Suspense>
      )}
    </main>
  )
}
