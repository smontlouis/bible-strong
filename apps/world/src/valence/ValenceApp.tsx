import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createAmbientEditor } from '../ambient-zones'
import { AvatarEditor, profileCopy } from '../AvatarEditor'
import { clampCameraZoom } from '../camera-zoom'
import { ControlIcon } from '../ControlIcon'
import { GuestbookDialog } from '../GuestbookDialog'
import { haptic } from '../haptics'
import type { Language } from '../language'
import { Modal } from '../Modal'
import { parseNavigation } from '../navigation-document'
import { ReactionPicker } from '../ReactionPicker'
import { createShoreEditor } from '../shorelines'
import { useCameraZoomGestures } from '../use-camera-zoom-gestures'
import type { UniverseProps } from '../universes'
import { selectEditors } from '../workshop/editors'
import type { NavigationDocument } from '../world'
import { useExplorerProfile, useJoystick, useWorldLanguage, useWorldScene, WorldPresence } from '../world-shell'
import { tileNavigation } from './navigation-tiles'
import { objectImage, ObjectCard, ShareCard } from './ObjectCard'
import { StationScene } from './StationScene'
import { valenceCopy } from './valence-copy'
import { createValence, type ValenceControls, type ValenceState } from './valence-game'
import { loadProgress, saveProgress, type ValenceProgress } from './valence-progress'
import { pioneerObjects, stations, type PioneerObjectId, type StationId } from './valence-story'
import type { EffectsModel } from './valence-ambience'
import { parseEffects, parseLayout, VALENCE_NAVIGATION } from './valence-documents'
import {
  applyLayout,
  nearestStation,
  nearPortal,
  objectWithinReach,
  stationAnchors,
  threadOrder,
  VALENCE_SPAWN,
  valencePortal,
} from './valence-world'
import { createWorkshop, type WorkshopMode } from './workshop-model'
import './valence.css'

const ValenceWorkshop = import.meta.env.DEV ? lazy(() => import('./ValenceWorkshop')) : () => null

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

async function loadJson(path: string) {
  const response = await fetch(path, { cache: 'no-cache' })
  if (!response.ok) throw new Error(path)
  return (await response.json()) as unknown
}

/** Editable project documents; the walkable zones are tiled for movement at runtime. */
async function loadValenceDocuments() {
  const [navigation, layout, effects] = await Promise.all([
    loadJson('./valence-1876/navigation.json'),
    loadJson('./valence-1876/layout.json'),
    loadJson('./valence-1876/effects.json'),
  ])
  return {
    navigation: parseNavigation(navigation, VALENCE_NAVIGATION),
    layout: parseLayout(layout),
    effects: parseEffects(effects),
  }
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

/** Valence 1876: Daniel Bourdeau's eleven months in the town, in sepia. */
export default function ValenceApp({ arrival, onTravel, onReady }: UniverseProps) {
  const stand = useMemo(() => new URLSearchParams(location.search).has('stand'), [])
  const debug = useMemo(() => import.meta.env.DEV && new URLSearchParams(location.search).has('debug'), [])
  const [language, setLanguage] = useWorldLanguage()
  const t = valenceCopy[language]
  const explorer = useExplorerProfile()
  const { profile, open: profileOpen, setOpen: setProfileOpen } = explorer
  const [workshopMode, setWorkshopMode] = useState<WorkshopMode | null>(null)
  const [effectsModel] = useState<EffectsModel>(() => ({ effects: null!, revision: 0 }))
  const [shoreEditor] = useState(() =>
    createShoreEditor({
      file: './valence-1876/shorelines.json',
      saveKey: 'valence-1876/shorelines',
      storageKey: 'bible-strong-valence-shorelines-v1',
      draftKey: 'bible-strong-valence-shorelines-draft-v1',
    })
  )
  const [ambientEditor] = useState(() =>
    createAmbientEditor({
      file: './valence-1876/ambience.json',
      saveKey: 'valence-1876/ambience',
      draftKey: 'bible-strong-valence-ambience-draft-v1',
    })
  )
  const [workshop] = useState(() => (import.meta.env.DEV ? createWorkshop(effectsModel) : undefined))
  const [progress, setProgress] = useState<ValenceProgress>(loadProgress)
  const visited = useMemo(() => new Set(progress.visited), [progress.visited])
  const found = useMemo(() => new Set(progress.found), [progress.found])
  const [introOpen, setIntroOpen] = useState(() => !loadProgress().introSeen || stand)
  const [opened, setOpened] = useState<StationId | null>(null)
  const [objectOpen, setObjectOpen] = useState<PioneerObjectId | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [guestbookOpen, setGuestbookOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [overview, setOverview] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const joystick = useRef<HTMLDivElement>(null)
  const stationTags = useRef<Partial<Record<StationId, HTMLElement | null>>>({})
  const controls = useRef<ValenceControls>({
    navigation: { version: 1, map: 'valence-1876', width: 1672, height: 941, zones: [] },
    effects: effectsModel,
    direction: { x: 0, y: 0 },
    avatar: profile.avatar,
    avatarColor: profile.color,
    avatarName: profile.name,
    shoreEditor,
    ambientEditor,
    workshop,
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
  /** The editable navigation document; `controls.navigation` holds its tiled runtime form. */
  const [navigation, setNavigation] = useState<NavigationDocument | null>(null)
  const { state, ready, revealing, failed, fail } = useWorldScene({
    host,
    controls,
    start: createValence,
    documentsLoaded: navigation !== null,
    arrival: Boolean(arrival),
    onReady,
    initialState: (): ValenceState => ({ ...VALENCE_SPAWN, moving: false, fps: 0 }),
  })
  const near = ready ? nearestStation(state) : null
  const atTrain = ready && nearPortal(state)
  const dialogOpen = Boolean(
    opened || objectOpen || shareOpen || guestbookOpen || menuOpen || introOpen || profileOpen || workshopMode
  )

  useCameraZoomGestures(host, controls, setOverview)
  useJoystick(joystick, controls, { front: '#f5e6c4', back: '#3b2414' })

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    document.title =
      language === 'fr'
        ? 'Valence 1876 — La Bible qu’ils lisaient, la Bible que tu étudies'
        : 'Valence 1876 — The Bible they read, the Bible you study'
  }, [language])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadValenceDocuments(), shoreEditor.load(), ambientEditor.load()])
      .then(([documents]) => {
        if (cancelled) return
        applyLayout(documents.layout)
        // Travellers from the archipelago step off the train.
        if (arrival) controls.current.portalArrival = { ...valencePortal.ground }
        effectsModel.effects = documents.effects
        effectsModel.revision++
        workshop?.markSaved('layout')
        workshop?.markSaved('effects')
        controls.current.navigation = tileNavigation(documents.navigation)
        setNavigation(documents.navigation)
      })
      .catch(() => !cancelled && fail())
    return () => {
      cancelled = true
    }
  }, [shoreEditor, ambientEditor, effectsModel, workshop])

  // The scene is created once; navigation edits from the workshop only swap the tiled document.
  useEffect(() => {
    if (navigation) controls.current.navigation = tileNavigation(navigation)
  }, [navigation])
  function switchWorkshop(mode: WorkshopMode | null) {
    if (workshop) {
      workshop.mode = mode
      workshop.notify()
    }
    selectEditors(mode, shoreEditor, ambientEditor)
    setWorkshopMode(mode)
  }

  /** Leaves for the archipelago; the journey's veil grows from `element`. */
  function leave(element: Element) {
    const box = element.getBoundingClientRect()
    controls.current.paused = true
    controls.current.direction = { x: 0, y: 0 }
    onTravel('archipelago', { x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }

  useEffect(() => {
    const c = controls.current
    c.paused = !ready || dialogOpen
    c.overview = overview
    c.visited = visited
    c.found = found
    c.avatar = profile.avatar
    c.avatarColor = profile.color
    c.avatarName = profile.name
    c.multiplayerEnabled = !workshopMode && !profileOpen
    c.activity = !ready
      ? null
      : guestbookOpen
        ? 'board'
        : opened || objectOpen || shareOpen
          ? 'exploration'
          : menuOpen || profileOpen
            ? 'menu'
            : null
    c.direction = { x: 0, y: 0 }
  }, [ready, dialogOpen, overview, visited, found, profile, profileOpen, workshopMode, guestbookOpen, opened, objectOpen, shareOpen, menuOpen])

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
    <main
      className={`valence-shell ${stand ? 'is-stand' : ''} ${ready ? '' : 'is-loading'} ${workshopMode ? 'is-workshop' : ''}`}
    >
      <div className="world-canvas" ref={host} aria-label={t.mapLabel} />
      <div className="v-vignette" aria-hidden="true" />

      {ready && (
        <header className="v-hud">
          <a
            className="v-brand"
            href="/"
            aria-label={t.world}
            onClick={event => {
              event.preventDefault()
              leave(event.currentTarget)
            }}
          >
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

      <button
        type="button"
        className="v-tag v-portal-tag"
        ref={element => {
          controls.current.portalTag = element
        }}
        data-near={atTrain}
        hidden={!ready}
        disabled={!ready || dialogOpen || !atTrain}
        aria-hidden={!atTrain}
        tabIndex={atTrain ? 0 : -1}
        onClick={event => leave(event.currentTarget)}
      >
        <span className="v-tag-order" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 16V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM5 11h14M8 21l1.5-3M16 21l-1.5-3" />
            <circle cx="8.5" cy="14.5" r=".6" fill="currentColor" />
            <circle cx="15.5" cy="14.5" r=".6" fill="currentColor" />
          </svg>
        </span>
        <span className="v-tag-text">
          <span className="v-tag-date">{t.trainDate}</span>
          <span className="v-tag-place">{t.trainPlace}</span>
        </span>
        <span className="v-tag-action">{t.trainAction}</span>
      </button>


      <aside className="v-bottom">
        <div className="joystick-zone" ref={joystick} role="group" aria-label={t.joystick} />
        {ready && !workshopMode && (
          <div className="v-social">
            {profile.name && (
              <WorldPresence
                className="v-presence"
                status={state.multiplayer}
                language={language}
                labels={t}
                onRetry={() => controls.current.retryMultiplayer?.()}
              />
            )}
            {!dialogOpen && (
              <ReactionPicker
                network={controls.current.network}
                color={profile.color}
                language={language}
                online={Boolean(controls.current.sendReaction)}
                onSend={reaction => controls.current.sendReaction?.(reaction) ?? false}
              />
            )}
          </div>
        )}
      </aside>
      {import.meta.env.DEV && ready && !workshopMode && (
        <button type="button" className="v-workshop-open" onClick={() => switchWorkshop('landmarks')}>
          {t.workshop}
        </button>
      )}
      {import.meta.env.DEV && workshop && workshopMode && navigation && (
        <Suspense fallback={null}>
          <ValenceWorkshop
            mode={workshopMode}
            onMode={switchWorkshop}
            model={workshop}
            controls={controls.current}
            shoreEditor={shoreEditor}
            ambientEditor={ambientEditor}
            navigation={navigation}
            onNavigation={setNavigation}
            language={language}
          />
        </Suspense>
      )}

      {stand && (
        <a className={`v-stand ${workshopMode ? 'is-hidden' : ''}`} href="https://world.bible-strong.app/valence-1876" target="_blank" rel="noreferrer">
          <img src="./valence-1876/qr.svg" width={150} height={150} alt="QR code — world.bible-strong.app/valence-1876" />
          <span>
            <strong>
              {t.standTitle[0]} <em>{t.standTitle[1]}</em>
            </strong>
            <span>{t.stand}</span>
          </span>
        </a>
      )}

      {!ready && (!arrival || failed) && (
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

      {ready && profileOpen && (
        <AvatarEditor
          eyebrow="BIBLE STRONG · VALENCE 1876"
          profile={profile}
          onboarding={explorer.onboarding}
          language={language}
          onClose={explorer.close}
          onSave={explorer.save}
        />
      )}
      {explorer.storageError && <p className="v-toast">{profileCopy[language].storage}</p>}

      {ready && introOpen && !profileOpen && (
        <Intro
          language={language}
          onEnter={() => {
            setIntroOpen(false)
            setProgress(old => ({ ...old, introSeen: true }))
          }}
        />
      )}

      {openedStation && (
        <StationScene
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
          onProfile={() => {
            setMenuOpen(false)
            setProfileOpen(true)
          }}
          onLeave={leave}
          onLanguage={setLanguage}
          overview={overview}
          onZoom={factor => {
            controls.current.zoom = clampCameraZoom(controls.current.zoom * factor, controls.current.minimumZoom)
            setOverview(false)
          }}
          onOverview={() => {
            setOverview(value => !value)
            setMenuOpen(false)
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
  onProfile,
  onLeave,
  onLanguage,
  overview,
  onZoom,
  onOverview,
}: {
  language: Language
  onLanguage: (language: Language) => void
  overview: boolean
  onZoom: (factor: number) => void
  onOverview: () => void
  visited: ReadonlySet<StationId>
  found: ReadonlySet<PioneerObjectId>
  onClose: () => void
  onLeave: (element: Element) => void
  onTravel: (id: StationId) => void
  onIntro: () => void
  onShare: () => void
  onRestart: () => void
  onProfile: () => void
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
      <h3>{t.settings}</h3>
      <div className="v-notebook-settings">
        <div className="v-notebook-setting" role="group" aria-label={t.languageLabel}>
          <span>{t.languageLabel}</span>
          <div className="v-segmented">
            {(['fr', 'en'] as const).map(lang => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-label={lang === 'fr' ? 'Français' : 'English'}
                aria-pressed={language === lang}
                onClick={() => onLanguage(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="v-notebook-setting" role="group" aria-label={t.camera}>
          <span>{t.camera}</span>
          <div className="v-segmented">
            <button type="button" onClick={() => onZoom(1 / 1.25)} aria-label={t.zoomOut} title={t.zoomOut}>
              <ControlIcon name="minus" />
            </button>
            <button type="button" onClick={() => onZoom(1.25)} aria-label={t.zoomIn} title={t.zoomIn}>
              <ControlIcon name="plus" />
            </button>
            <button type="button" aria-pressed={overview} onClick={onOverview} title={overview ? t.follow : t.overview}>
              <ControlIcon name={overview ? 'follow' : 'overview'} />
              <span>{overview ? t.follow : t.overview}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="v-nav v-notebook-actions">
        {found.size === pioneerObjects.length && (
          <button type="button" className="v-primary" onClick={onShare}>
            {t.share}
          </button>
        )}
        <button type="button" className="v-secondary" onClick={onProfile}>
          {t.changeAvatar}
        </button>
        <button type="button" className="v-secondary" onClick={onIntro}>
          {t.replayIntro}
        </button>
        <button type="button" className="v-secondary" onClick={onRestart}>
          {t.restart}
        </button>
        <a
          className="v-secondary"
          href="/"
          onClick={event => {
            event.preventDefault()
            onLeave(event.currentTarget)
          }}
        >
          {t.world}
        </a>
      </div>
    </Modal>
  )
}
