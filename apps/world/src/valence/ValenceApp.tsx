import nipplejs from 'nipplejs'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { generateExplorerProfile, loadProfile } from '../avatar-profile'
import { clampCameraZoom } from '../camera-zoom'
import { ControlIcon } from '../ControlIcon'
import type { Controls } from '../game'
import { GuestbookDialog } from '../GuestbookDialog'
import { haptic } from '../haptics'
import { loadLanguage, saveLanguage, type Language } from '../language'
import { Modal } from '../Modal'
import { useCameraZoomGestures } from '../use-camera-zoom-gestures'
import { ARRIVAL_FADE_MS, MINIMUM_LOADING_MS } from '../world-arrival'
import type { NavigationDocument } from '../world'
import { objectImage, ObjectCard, ShareCard } from './ObjectCard'
import { StationDialog } from './StationDialog'
import { valenceCopy } from './valence-copy'
import { createValence, type ValenceControls, type ValenceState } from './valence-game'
import { loadProgress, saveProgress, type ValenceProgress } from './valence-progress'
import { pioneerObjects, stations, type PioneerObjectId, type StationId } from './valence-story'
import {
  nearestStation,
  objectWithinReach,
  stationAnchors,
  threadOrder,
  VALENCE_SPAWN,
} from './valence-world'
import './valence.css'

const STAND_IDLE_MS = 150_000
const byId = new Map(stations.map(station => [station.id, station]))
const shortDates: Record<Language, Partial<Record<StationId, string>>> = {
  fr: {
    gare: 'Oct. 1876',
    temple: 'Automne',
    maison: 'Hiver',
    cathedrale: 'Fév. 1877',
    champ: 'Mars-oct.',
    clercs: 'Été',
    rhone: 'Sept. 1877',
  },
  en: {
    gare: 'Oct. 1876',
    temple: 'Autumn',
    maison: 'Winter',
    cathedrale: 'Feb. 1877',
    champ: 'Mar.-Oct.',
    clercs: 'Summer',
    rhone: 'Sep. 1877',
  },
}

async function loadValenceNavigation(): Promise<NavigationDocument> {
  const response = await fetch('./valence-1876/navigation.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error('navigation')
  return (await response.json()) as NavigationDocument
}

function Timeline({
  language,
  visited,
  current,
  onTravel,
  disabled,
}: {
  language: Language
  visited: ReadonlySet<StationId>
  current: StationId | null
  onTravel: (id: StationId) => void
  disabled: boolean
}) {
  const t = valenceCopy[language]
  const memory = byId.get('citadelle')!
  const dated = threadOrder.filter(id => id !== 'citadelle')
  return (
    <nav className="v-timeline" aria-label={t.timeline}>
      <button
        type="button"
        className="v-stop v-stop-memory"
        data-visited={visited.has('citadelle')}
        data-current={current === 'citadelle'}
        disabled={disabled}
        onClick={() => onTravel('citadelle')}
        aria-label={`${t.travel} ${memory.place[language]} · ${memory.date[language]}`}
      >
        <span className="v-stop-dot" />
        <span className="v-stop-year">1799</span>
      </button>
      <span className="v-timeline-gap" aria-hidden="true" />
      <ol>
        {dated.map(id => {
          const station = byId.get(id)!
          return (
            <li key={id}>
              <button
                type="button"
                className="v-stop"
                data-visited={visited.has(id)}
                data-current={current === id}
                disabled={disabled}
                onClick={() => onTravel(id)}
                aria-label={`${t.travel} ${station.place[language]} · ${station.date[language]}`}
              >
                <span className="v-stop-dot" />
                <span className="v-stop-label">{shortDates[language][id]}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Intro({ language, onEnter }: { language: Language; onEnter: () => void }) {
  const t = valenceCopy[language]
  const titleId = useId()
  const enter = useRef<HTMLButtonElement>(null)
  return (
    <Modal className="valence-modal v-intro" labelledBy={titleId} closeLabel={t.close} onClose={onEnter} initialFocus={enter}>
      <p className="v-date">{t.introEyebrow}</p>
      <h1 id={titleId}>{t.title}</h1>
      <p className="v-intro-lead">{t.intro}</p>
      <p className="v-intro-hint">{t.introHint}</p>
      <button type="button" className="v-primary" ref={enter} onClick={onEnter}>
        {t.enter}
      </button>
    </Modal>
  )
}

export default function ValenceApp() {
  const stand = useMemo(() => new URLSearchParams(location.search).has('stand'), [])
  const debug = useMemo(() => import.meta.env.DEV && new URLSearchParams(location.search).has('debug'), [])
  const [language, setLanguage] = useState<Language>(loadLanguage)
  const t = valenceCopy[language]
  const [profile] = useState(() => loadProfile() ?? generateExplorerProfile())
  const [progress, setProgress] = useState<ValenceProgress>(loadProgress)
  const visited = useMemo(() => new Set(progress.visited), [progress.visited])
  const found = useMemo(() => new Set(progress.found), [progress.found])
  const [navigation, setNavigation] = useState<NavigationDocument | null>(null)
  const [failed, setFailed] = useState(false)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [ready, setReady] = useState(false)
  const [introOpen, setIntroOpen] = useState(() => !loadProgress().introSeen || stand)
  const [opened, setOpened] = useState<StationId | null>(null)
  const [objectOpen, setObjectOpen] = useState<PioneerObjectId | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [guestbookOpen, setGuestbookOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [overview, setOverview] = useState(false)
  const [state, setState] = useState<ValenceState>({ ...VALENCE_SPAWN, moving: false, fps: 0 })
  const host = useRef<HTMLDivElement>(null)
  const joystick = useRef<HTMLDivElement>(null)
  const stationTags = useRef<Partial<Record<StationId, HTMLElement | null>>>({})
  const controls = useRef<ValenceControls>({
    navigation: { version: 1, map: 'archipelago', width: 1672, height: 941, zones: [] },
    direction: { x: 0, y: 0 },
    avatar: profile.avatar,
    avatarColor: profile.color,
    paused: true,
    overview: false,
    debug,
    zoom: window.matchMedia('(hover: none) and (pointer: coarse)').matches ? 1.35 : 1.8,
    minimumZoom: 0,
    reset: 0,
    stand,
    arrivalStartedAt: null,
    visited,
    found,
    stationTags: stationTags.current,
  })
  if (import.meta.env.DEV) (window as unknown as { valence?: ValenceControls }).valence = controls.current
  const near = ready ? nearestStation(state) : null
  const dialogOpen = Boolean(opened || objectOpen || shareOpen || guestbookOpen || menuOpen || introOpen)

  useCameraZoomGestures(host, controls as unknown as RefObject<Controls>, setOverview)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    document.documentElement.lang = language
    saveLanguage(language)
    document.title =
      language === 'fr'
        ? 'Valence 1876 — La Bible qu’ils lisaient, la Bible que tu étudies'
        : 'Valence 1876 — The Bible they read, the Bible you study'
  }, [language])

  useEffect(() => {
    let cancelled = false
    loadValenceNavigation()
      .then(document => {
        if (cancelled) return
        controls.current.navigation = document
        setNavigation(document)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!navigation) return
    const game = createValence(
      host.current!,
      controls.current,
      setState,
      () => setSceneLoaded(true),
      () => setFailed(true)
    )
    return () => game.destroy(true)
  }, [navigation])

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
  }, [sceneLoaded, minimumElapsed, failed])

  useEffect(() => {
    const stick = nipplejs.create({
      zone: joystick.current!,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      size: 112,
      color: { front: '#f5e6c4', back: '#3b2414' },
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
    return () => {
      stick.destroy()
      window.removeEventListener('blur', stop)
    }
  }, [])

  useEffect(() => {
    const c = controls.current
    c.paused = !ready || dialogOpen
    c.overview = overview
    c.visited = visited
    c.found = found
    c.direction = { x: 0, y: 0 }
  }, [ready, dialogOpen, overview, visited, found])

  // Walking onto a pioneer object picks it up.
  const pickupTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!ready || dialogOpen) return
    const id = objectWithinReach(state, found)
    if (!id) return
    setProgress(old => ({ ...old, found: [...old.found, id] }))
    haptic('success')
    // Let the golden burst play on the map before the card opens.
    clearTimeout(pickupTimer.current)
    pickupTimer.current = setTimeout(() => setObjectOpen(id), 650)
  }, [state, ready, dialogOpen, found])
  useEffect(() => () => clearTimeout(pickupTimer.current), [])

  // A stand resets itself after a quiet while, ready for the next visitor.
  const lastActivity = useRef(performance.now())
  useEffect(() => {
    if (!stand) return
    const mark = () => (lastActivity.current = performance.now())
    window.addEventListener('pointerdown', mark)
    window.addEventListener('keydown', mark)
    const timer = setInterval(() => {
      if (performance.now() - lastActivity.current < STAND_IDLE_MS) return
      lastActivity.current = performance.now()
      setOpened(null)
      setObjectOpen(null)
      setShareOpen(false)
      setGuestbookOpen(false)
      setMenuOpen(false)
      setProgress({ visited: [], found: [], introSeen: true })
      controls.current.reset++
      setIntroOpen(true)
    }, 5000)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', mark)
      window.removeEventListener('keydown', mark)
    }
  }, [stand])

  const openStation = useCallback(
    (id: StationId) => {
      if (!ready || controls.current.paused) return
      haptic('select')
      setOpened(id)
      setProgress(old => (old.visited.includes(id) ? old : { ...old, visited: [...old.visited, id] }))
    },
    [ready]
  )

  function travel(id: StationId) {
    controls.current.travelTo = stationAnchors[id]
    controls.current.arrivalStartedAt = undefined
    setOverview(false)
    setMenuOpen(false)
  }

  function closeObject() {
    setObjectOpen(null)
    if (found.size === pioneerObjects.length) setShareOpen(true)
  }

  const openedStation = opened ? byId.get(opened)! : null
  const objectData = objectOpen ? pioneerObjects.find(object => object.id === objectOpen)! : null

  return (
    <main className={`valence-shell ${stand ? 'is-stand' : ''} ${ready ? '' : 'is-loading'}`}>
      <div className="world-canvas" ref={host} aria-label={t.mapLabel} />
      <div className="v-vignette" aria-hidden="true" />

      {ready && (
        <header className="v-hud">
          <a className="v-brand" href="/" aria-label={t.world}>
            <span className="v-brand-title">{t.title}</span>
            <span className="v-brand-sub">{t.subtitle}</span>
          </a>
          <Timeline
            language={language}
            visited={visited}
            current={near}
            disabled={dialogOpen}
            onTravel={travel}
          />
          <button
            type="button"
            className="v-objects"
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
            aria-label={`${t.objects} : ${found.size} ${t.found} / ${pioneerObjects.length}`}
          >
            <span className="v-objects-row" aria-hidden="true">
              {pioneerObjects.map(object => (
                <img key={object.id} src={objectImage(object.id)} alt="" data-found={found.has(object.id)} />
              ))}
            </span>
            <span className="v-objects-count">
              {found.size}/{pioneerObjects.length}
            </span>
          </button>
        </header>
      )}

      {threadOrder.map(id => {
        const station = byId.get(id)!
        const here = near === id
        return (
          <button
            key={id}
            type="button"
            className="v-tag"
            ref={element => {
              stationTags.current[id] = element
            }}
            data-near={here}
            data-visited={visited.has(id)}
            hidden={!ready}
            disabled={!ready || dialogOpen || !here}
            aria-hidden={!here}
            tabIndex={here ? 0 : -1}
            aria-haspopup="dialog"
            onClick={() => openStation(id)}
          >
            <span className="v-tag-order">{station.order}</span>
            <span className="v-tag-text">
              <span className="v-tag-date">{station.date[language]}</span>
              <span className="v-tag-place">{station.place[language]}</span>
            </span>
            <span className="v-tag-action">{station.id === 'citadelle' ? t.visit : t.listen}</span>
          </button>
        )
      })}

      <aside className="v-camera" aria-label={t.camera}>
        <button type="button" onClick={() => {
          controls.current.zoom = clampCameraZoom(controls.current.zoom * 1.25, controls.current.minimumZoom)
          setOverview(false)
        }} aria-label={t.zoomIn} title={t.zoomIn}>
          <ControlIcon name="plus" />
        </button>
        <button type="button" onClick={() => {
          controls.current.zoom = clampCameraZoom(controls.current.zoom / 1.25, controls.current.minimumZoom)
          setOverview(false)
        }} aria-label={t.zoomOut} title={t.zoomOut}>
          <ControlIcon name="minus" />
        </button>
        <button type="button" aria-pressed={overview} onClick={() => setOverview(value => !value)} aria-label={overview ? t.follow : t.overview} title={overview ? t.follow : t.overview}>
          <ControlIcon name={overview ? 'follow' : 'overview'} />
        </button>
        <button type="button" className="v-language" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
          {language === 'fr' ? 'EN' : 'FR'}
        </button>
      </aside>

      <aside className="v-bottom">
        <div className="joystick-zone" ref={joystick} role="group" aria-label={t.joystick} />
        {ready && !stand && <p className="v-keys">{t.keys}</p>}
      </aside>

      {stand && (
        <a className="v-stand" href="https://world.bible-strong.app/valence-1876" target="_blank" rel="noreferrer">
          <img src="./valence-1876/qr.svg" width={150} height={150} alt="QR code — world.bible-strong.app/valence-1876" />
          <span>
            <strong>
              {t.standTitle[0]} <em>{t.standTitle[1]}</em>
            </strong>
            <span>{t.stand}</span>
          </span>
        </a>
      )}

      {!ready && (
        <div className="v-loading" data-revealing={revealing} role="status">
          <p className="v-loading-title">{t.title}</p>
          <p className="v-loading-sub">{failed ? t.failed : t.loading}</p>
          {failed && (
            <button type="button" className="v-primary" onClick={() => location.reload()}>
              {t.reload}
            </button>
          )}
          {!failed && <span className="v-loading-track" aria-hidden="true" />}
        </div>
      )}

      {ready && introOpen && (
        <Intro
          language={language}
          onEnter={() => {
            setIntroOpen(false)
            setProgress(old => ({ ...old, introSeen: true }))
          }}
        />
      )}

      {openedStation && (
        <StationDialog
          key={`${openedStation.id}-${language}`}
          station={openedStation}
          language={language}
          onClose={() => setOpened(null)}
          closing={
            openedStation.id === 'rhone' ? (
              <div className="v-epilogue-actions">
                <p>{t.guestbookIntro}</p>
                <button
                  type="button"
                  className="v-primary"
                  onClick={() => {
                    setOpened(null)
                    setGuestbookOpen(true)
                  }}
                >
                  {t.guestbook}
                </button>
              </div>
            ) : null
          }
        />
      )}
      {objectData && (
        <ObjectCard object={objectData} count={found.size} language={language} onClose={closeObject} />
      )}
      {shareOpen && <ShareCard language={language} name={profile.name} onClose={() => setShareOpen(false)} />}
      {guestbookOpen && (
        <GuestbookDialog profile={profile} language={language} onClose={() => setGuestbookOpen(false)} />
      )}
      {menuOpen && (
        <Notebook
          language={language}
          visited={visited}
          found={found}
          onClose={() => setMenuOpen(false)}
          onTravel={travel}
          onIntro={() => {
            setMenuOpen(false)
            setIntroOpen(true)
          }}
          onShare={() => {
            setMenuOpen(false)
            setShareOpen(true)
          }}
          onRestart={() => {
            setMenuOpen(false)
            setProgress({ visited: [], found: [], introSeen: true })
            controls.current.reset++
          }}
        />
      )}
      {debug && (
        <p className="v-debug">
          {Math.round(state.x)}, {Math.round(state.y)} · {state.fps} fps
        </p>
      )}
    </main>
  )
}

function Notebook({
  language,
  visited,
  found,
  onClose,
  onTravel,
  onIntro,
  onShare,
  onRestart,
}: {
  language: Language
  visited: ReadonlySet<StationId>
  found: ReadonlySet<PioneerObjectId>
  onClose: () => void
  onTravel: (id: StationId) => void
  onIntro: () => void
  onShare: () => void
  onRestart: () => void
}) {
  const t = valenceCopy[language]
  const titleId = useId()
  return (
    <Modal className="valence-modal v-notebook" labelledBy={titleId} closeLabel={t.close} onClose={onClose}>
      <p className="v-date">{t.menu}</p>
      <h2 id={titleId}>{t.title}</h2>
      <p className="v-notebook-count">
        {visited.size}/{stations.length} {t.visited} · {found.size}/{pioneerObjects.length} {t.found}
      </p>
      <ol className="v-notebook-stations">
        {threadOrder.map(id => {
          const station = byId.get(id)!
          return (
            <li key={id} data-visited={visited.has(id)}>
              <button type="button" onClick={() => onTravel(id)}>
                <span className="v-tag-order">{station.order}</span>
                <span>
                  <strong>{station.place[language]}</strong>
                  <span>{station.date[language]}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <h3>{t.objects}</h3>
      <ul className="v-notebook-objects">
        {pioneerObjects.map(object => (
          <li key={object.id} data-found={found.has(object.id)}>
            <img src={objectImage(object.id)} alt="" width={56} height={56} />
            <span>{found.has(object.id) ? object.name[language] : '?'}</span>
          </li>
        ))}
      </ul>
      <div className="v-nav v-notebook-actions">
        {found.size === pioneerObjects.length && (
          <button type="button" className="v-primary" onClick={onShare}>
            {t.share}
          </button>
        )}
        <button type="button" className="v-secondary" onClick={onIntro}>
          {t.replayIntro}
        </button>
        <button type="button" className="v-secondary" onClick={onRestart}>
          {t.restart}
        </button>
        <a className="v-secondary" href="/">
          {t.world}
        </a>
      </div>
    </Modal>
  )
}
