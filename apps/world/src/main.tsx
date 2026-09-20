import { createAmbientEditor, ambientKinds } from './ambient-zones'
import { AmbientEditorPanel, EditorNavigation, editorCopy, type EditorMode } from './WorldEditor'
import { createShoreEditor } from './shorelines'
import { ShoreEditor } from './ShoreEditor'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import nipplejs from 'nipplejs'
import { clampCameraZoom } from './camera-zoom'
import { createWorld, type Controls, type WorldState } from './game'
import { defaultNavigation, SPAWN, stations } from './world'
import { loadNavigation, navigationFingerprint } from './navigation-document'
import { useCameraZoomGestures } from './use-camera-zoom-gestures'
import { diagnosticCategories, diagnosticCopy, makeDiagnosticFilters } from './diagnostic-filters'
import { DictionaryDiscovery } from './DictionaryDiscovery'
import { LexiconDiscovery } from './LexiconDiscovery'
import { ReferencesDiscovery } from './ReferencesDiscovery'
import { ThemesDiscovery } from './ThemesDiscovery'
import { ComparisonsDiscovery } from './ComparisonsDiscovery'
import { CommentariesDiscovery } from './CommentariesDiscovery'
import { AvatarEditor, AvatarPreview, profileCopy } from './AvatarEditor'
import { DEFAULT_PROFILE, loadProfile, saveProfile } from './avatar-profile'
import { loadVisitedPlaces, saveVisitedPlaces } from './visited-places'
import './style.css'
const ZoneEditor = lazy(() => import('./ZoneEditor'))

const copy = {
  fr: {
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
    error: 'Impossible de charger la carte. Recharge la page.',
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
    error: 'Unable to load the map. Reload the page.',
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
  labels: Pick<(typeof copy)['fr'], 'follow' | 'home' | 'overview' | 'zoomIn' | 'zoomOut'>
}) {
  return (
    <nav className="camera-controls" aria-label="Camera">
      <button
        onClick={() => setOverview(value => !value)}
        title={overview ? labels.follow : labels.overview}
        aria-label={overview ? labels.follow : labels.overview}
        aria-pressed={overview}
      >
        {overview ? '◎' : '⌘'}
      </button>
      <button
        aria-label={labels.zoomIn}
        onClick={() => {
          controls.zoom = clampCameraZoom(controls.zoom + 0.2)
          setOverview(false)
        }}
      >
        +
      </button>
      <button
        aria-label={labels.zoomOut}
        onClick={() => {
          controls.zoom = clampCameraZoom(controls.zoom - 0.2)
          setOverview(false)
        }}
      >
        −
      </button>
      <button
        aria-label={labels.home}
        onClick={() => {
          controls.reset++
          setOverview(false)
        }}
      >
        ↺
      </button>
    </nav>
  )
}

function App() {
  const [savedProfile] = useState(loadProfile)
  const [profile, setProfile] = useState(savedProfile ?? DEFAULT_PROFILE)
  const [profileOpen, setProfileOpen] = useState(!savedProfile)
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
    navigation: initial.document,
    direction: { x: 0, y: 0 },
    avatar: profile.avatar,
    avatarColor: profile.color,
    avatarName: profile.name,
    paused: !savedProfile,
    overview: false,
    debug: false,
    zoom: 1,
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
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [overview, setOverview] = useState(false)
  const [debug, setDebug] = useState(() => new URLSearchParams(location.search).has('debug'))
  const [diagnosticFilters, setDiagnosticFilters] = useState(() => makeDiagnosticFilters())
  const [language, setLanguage] = useState<Language>('fr')
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
      () => setReady(true),
      () => setFailed(true)
    )
    return () => game.destroy(true)
  }, [navigationLoaded])

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
    controls.current.avatar = profile.avatar
    controls.current.avatarColor = profile.color
    controls.current.avatarName = profile.name
    controls.current.overview = overview
    controls.current.debug = debug
    controls.current.diagnosticFilters = diagnosticFilters
    controls.current.paused = Boolean(opened) || Boolean(editorMode) || profileOpen
    controls.current.multiplayerEnabled = !editorMode
    controls.current.navigation = navigation
    controls.current.direction = { x: 0, y: 0 }
  }, [profile, profileOpen, overview, debug, diagnosticFilters, opened, editorMode, navigation])
  useEffect(() => {
    document.documentElement.lang = language
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
    controls.current.paused = Boolean(mode) || Boolean(opened) || profileOpen
    controls.current.direction = { x: 0, y: 0 }
    setEditorMode(mode)
  }

  function discover() {
    if (!state.station) return
    controls.current.paused = true
    controls.current.direction = { x: 0, y: 0 }
    setOpened(state.station)
    setVisited(old => (old.includes(state.station!.id) ? old : [...old, state.station!.id]))
  }

  return (
    <main
      className={`world-shell ${editing ? 'is-editing' : ''} ${editorMode ? 'is-world-editing' : ''}`}
    >
      <div className="world-canvas" ref={host} aria-label="Bible Strong — archipel" />
      <header className="world-header">
        <div className="world-brand">
          <span className="brand-mark">●</span>
          <div>
            <strong>{t.brand}</strong>
            <small>{t.title}</small>
          </div>
        </div>
        <select
          aria-label="Language"
          value={language}
          onChange={e => setLanguage(e.target.value as Language)}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </header>
      <div className="journey-pill">
        <span className="live-dot" />
        {state.station ? name(state.station) : t.here}
        <span className="journey-count">{visited.length}/6</span>
      </div>
      <CameraControls
        controls={controls.current}
        overview={overview}
        setOverview={setOverview}
        labels={t}
      />
      {!ready && (
        <div className="loading">
          <span className="loading-blob">··</span>
          {failed ? t.error : t.loading}
        </div>
      )}
      <button
        ref={element => {
          controls.current.discoveryAction = element
        }}
        className="discover-button"
        disabled={!ready || !state.station}
        onClick={discover}
      >
        {t.explore} →
      </button>
      <aside className="world-bottom">
        <div className="joystick-zone" ref={joystick} role="group" aria-label={t.joystick} />
        <div className="companion-controls">
          <button
            className="profile-button"
            aria-label={profileCopy[language].edit}
            aria-haspopup="dialog"
            onClick={() => {
              controls.current.paused = true
              controls.current.direction = { x: 0, y: 0 }
              setProfileOpen(true)
            }}
          >
            <AvatarPreview color={profile.color} avatar={profile.avatar} />
            <span className="profile-button-copy">
              <strong>{profile.name || profileCopy[language].guest}</strong>
              <small>{profileCopy[language].edit} ↗</small>
            </span>
          </button>
          {ready && profile.name && !editorMode && (
            <div className="world-presence" data-state={state.multiplayer?.state ?? 'connecting'} role="status" aria-live="polite">
              <span className="presence-dot" aria-hidden="true" />
              <span>{state.multiplayer?.state === 'online'
                ? `${state.multiplayer.count} ${t.online}`
                : t[state.multiplayer?.state ?? 'connecting']}</span>
              {state.multiplayer?.state === 'full' && <button onClick={() => controls.current.retryMultiplayer?.()}>{t.retry}</button>}
            </div>
          )}
          {profileStorageError && (
            <span className="profile-storage-error" role="status">
              {profileCopy[language].storage}
            </span>
          )}
        </div>
      </aside>
      <footer className="world-footer">
        {initial.error && <span title={t.draftError}>{t.draftError}</span>}
        <div className="footer-actions">
          <button disabled={!ready || !navigationLoaded} onClick={() => switchEditor('shorelines')}>
            {editorCopy[language].open}
          </button>
          <button onClick={() => setDebug(v => !v)} aria-pressed={debug}>
            {t.debug}
          </button>
        </div>
      </footer>
      {debug && (
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
      {profileOpen && (
        <AvatarEditor
          profile={profile}
          language={language}
          onClose={() => setProfileOpen(false)}
          onSave={next => {
            setProfileStorageError(!saveProfile(next))
            setProfile(next)
            setProfileOpen(false)
          }}
        />
      )}
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
      {editorMode && (
        <EditorNavigation
          mode={editorMode}
          language={language}
          onMode={switchEditor}
          onClose={() => switchEditor(null)}
        />
      )}
      {ambientEditor.editing && (
        <AmbientEditorPanel
          model={ambientEditor}
          language={language}
          onZoom={factor => {
            controls.current.shoreZoom = factor
          }}
        />
      )}
      {shoreEditing && (
        <ShoreEditor
          model={shoreEditor}
          language={language}
          onZoom={factor => {
            controls.current.shoreZoom = factor
          }}
          onClose={() => switchEditor(null)}
        />
      )}
      {editing && (
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

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
