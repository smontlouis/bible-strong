import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import nipplejs from 'nipplejs'
import { clampCameraZoom } from './camera-zoom'
import { createWorld, type Avatar, type Controls, type WorldState } from './game'
import { defaultNavigation, SPAWN, stations } from './world'
import { loadNavigation, navigationFingerprint } from './navigation-document'
import { useCameraZoomGestures } from './use-camera-zoom-gestures'
import './style.css'
const ZoneEditor = lazy(() => import('./ZoneEditor'))

const copy = {
  fr: {
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
  zh: {
    title: '探索这个世界',
    brand: 'Bible Strong',
    hint: '使用摇杆移动你的角色。',
    home: '返回广场',
    overview: '世界全景',
    follow: '跟随角色',
    explore: '探索',
    close: '关闭',
    joystick: '移动摇杆',
    here: '圣经广场',
    prototype: '原型 · ASI Europe',
    loading: '正在准备旅程…',
    error: '无法加载地图，请刷新页面。',
    visit: '靠近各个地点以了解更多。',
    keyboard: '方向键 / WASD / ZQSD',
    debug: '诊断',
    edit: '编辑区域',
    draftError: '无法读取项目导航文件，已加载原始地图。',
    intro: '这是此资源的初步预览。Bible Strong 的演示将在后续阶段添加。',
    zoomIn: '放大',
    zoomOut: '缩小',
    choose: '选择角色',
    walked: '已探索地点',
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
  const [initial, setInitial] = useState(() => ({
    document: structuredClone(defaultNavigation),
    error: false,
  }))
  const [navigation, setNavigation] = useState(initial.document)
  const [navigationLoaded, setNavigationLoaded] = useState(false)
  const savedNavigation = useRef(DEFAULT_NAVIGATION_FINGERPRINT)
  const [editing, setEditing] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const joystick = useRef<HTMLDivElement>(null)
  const controls = useRef<Controls>({
    navigation: initial.document,
    direction: { x: 0, y: 0 },
    avatar: 'nova',
    paused: false,
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
  const [avatar, setAvatar] = useState<Avatar>('nova')
  const [language, setLanguage] = useState<Language>('fr')
  const [opened, setOpened] = useState<WorldState['station']>(null)
  const [visited, setVisited] = useState<string[]>([])
  const t = copy[language]
  const name = (station: (typeof stations)[number]) =>
    language === 'fr' ? station.name : station[language]

  useCameraZoomGestures(host, controls, setOverview)

  useEffect(() => {
    let cancelled = false
    void loadNavigation().then(result => {
      if (cancelled) return
      setInitial(result)
      setNavigation(result.document)
      savedNavigation.current = navigationFingerprint(result.document)
      setNavigationLoaded(true)
    })
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
    controls.current.avatar = avatar
    controls.current.overview = overview
    controls.current.debug = debug
    controls.current.paused = Boolean(opened) || editing
    controls.current.navigation = navigation
    controls.current.direction = { x: 0, y: 0 }
  }, [avatar, overview, debug, opened, editing, navigation])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (navigationFingerprint(navigation) !== savedNavigation.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [navigation])

  function discover() {
    if (!state.station) return
    controls.current.paused = true
    controls.current.direction = { x: 0, y: 0 }
    setOpened(state.station)
    setVisited(old => (old.includes(state.station!.id) ? old : [...old, state.station!.id]))
  }

  return (
    <main className={`world-shell ${editing ? 'is-editing' : ''}`}>
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
          <option value="zh">中文</option>
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
      <aside className="world-bottom">
        <div className="joystick-zone" ref={joystick} role="group" aria-label={t.joystick}>
          <span className="joystick-caption">{t.keyboard}</span>
        </div>
        <div className="companion-controls">
          <div className="avatar-choices" role="group" aria-label={t.choose}>
            {(['nova', 'citrus', 'strobi'] as const).map(a => (
              <button
                key={a}
                aria-label={a}
                aria-pressed={a === avatar}
                onClick={() => setAvatar(a)}
              >
                <img src={`./assets/${a}.png`} alt="" />
              </button>
            ))}
          </div>
          <button
            className="discover-button"
            disabled={!state.station || !ready}
            onClick={discover}
          >
            {state.station ? `${t.explore} →` : t.visit}
          </button>
        </div>
      </aside>
      <footer className="world-footer">
        <span title={initial.error ? t.draftError : undefined}>
          {initial.error ? t.draftError : t.prototype}
        </span>
        <div className="footer-actions">
          <button
            disabled={!ready || !navigationLoaded}
            onClick={() => {
              controls.current.paused = true
              controls.current.direction = { x: 0, y: 0 }
              setEditing(true)
            }}
          >
            {t.edit}
          </button>
          <button onClick={() => setDebug(v => !v)} aria-pressed={debug}>
            {t.debug}
          </button>
        </div>
      </footer>
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
      {opened && (
        <div className="modal-scrim" onClick={() => setOpened(null)}>
          <section
            className="resource-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-title"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpened(null)
              if (e.key === 'Tab') e.preventDefault()
            }}
          >
            <div className="resource-icon" style={{ background: opened.color }}>
              ▤
            </div>
            <small>
              {t.brand} · {visited.length}/6 {t.walked}
            </small>
            <h1 id="resource-title">{name(opened)}</h1>
            <p>{t.intro}</p>
            <button autoFocus onClick={() => setOpened(null)}>
              {t.close}
            </button>
          </section>
        </div>
      )}
      {editing && (
        <Suspense fallback={<div className="zone-editor">{t.loading}</div>}>
          <ZoneEditor
            initial={navigation}
            language={language}
            onSave={next => {
              savedNavigation.current = navigationFingerprint(next)
              setNavigation(next)
            }}
            onTest={next => {
              setNavigation(next)
              setEditing(false)
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
