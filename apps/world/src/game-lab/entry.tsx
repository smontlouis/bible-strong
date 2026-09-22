import { tickSolo, pauseSolo, resumeSolo } from '../solo-game'
import React, { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BibleGamesView } from '../BibleGamesView'
import { installButtonHaptics } from '../haptics'
import type { GameAction } from '../games-protocol'
import {
  act,
  flows,
  finishSoloLab,
  makeStory,
  people,
  reveal,
  settle,
  stories,
  type LabConfig,
  type LabModel,
  type StoryId,
} from './stories'
import '../style.css'
import './lab.css'

const params = new URLSearchParams(location.search)
const initialStory = stories.some(s => s[0] === params.get('state'))
  ? (params.get('state') as StoryId)
  : 'your-turn'
const initialConfig: LabConfig = {
  language: params.get('lang') === 'en' ? 'en' : 'fr',
  players: Math.max(2, Math.min(4, Math.floor(Number(params.get('players'))) || 2)),
  perspective: Math.max(0, Math.min(3, Math.floor(Number(params.get('viewer'))) || 0)),
}
const signal = 'bible-strong-game-lab'
function Frame() {
  const [model, setModel] = useState(() => makeStory(initialStory, initialConfig))
  const [running, setRunning] = useState(false)
  const [job, setJob] = useState(0)
  const celebration = useRef<ReturnType<typeof setTimeout> | null>(null)
  function log(action: string) {
    window.parent.postMessage({ signal, event: action }, location.origin)
  }
  useEffect(() => {
    if (!job) return
    const timer = setTimeout(() => {
      setModel(settle)
      log('Réponse simulée reçue')
    }, 1200)
    return () => clearTimeout(timer)
  }, [job])
  function tick(m: LabModel, ms: number): LabModel {
    const next = structuredClone(m)
    next.now += ms
    next.invitations = next.invitations.filter(i => i.expires > next.now)
    const g = next.game
    if (g?.solo) {
      tickSolo(g.solo, next.now)
      if (g.solo.outcome) finishSoloLab(next)
      return next
    }
    if (
      g?.phase === 'question' &&
      g.pausedAt === null &&
      !g.who?.frozenAt &&
      g.deadline <= next.now
    ) {
      if (g.who && g.who.zone < 3) {
        const zone = g.who.zone + 1
        const replacement = makeStory(`clue-${zone + 1}` as StoryId, initialConfig, next.now).game!
        g.who.zone = zone
        g.who.points = 4 - zone
        g.who.eligible =
          g.who.mode === 'race' ? g.players.map(p => p.id) : [g.players[(g.round + zone) % 2].id]
        g.who.active = g.who.mode === 'duel' ? g.who.eligible[0] : null
        delete g.ownAnswer
        g.answered = []
        g.clues = replacement.clues
        g.deadline = replacement.deadline
      } else {
        reveal(next, false)
        if (g.who) {
          delete g.who.winner
          g.who.awarded = 0
          g.result!.answers.forEach(a => (a.status = 'skipped'))
        }
      }
    }
    return next
  }
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setModel(m => tick(m, 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.signal !== signal
      )
        return
      const command = event.data.command
      if (
        (command === 'story' || command === 'restart-story') &&
        stories.some(s => s[0] === event.data.value)
      ) {
        setJob(0)
        if (celebration.current) clearTimeout(celebration.current)
        setRunning(false)
        setModel(previous => {
          const next = makeStory(event.data.value as StoryId, initialConfig, previous.now)
          if (next.game)
            next.game.id =
              command === 'restart-story'
                ? `lab-game-${Date.now()}`
                : (previous.game?.id ?? next.game.id)
          return next
        })
      }
      if (command === 'clock') setRunning(Boolean(event.data.value))
      if (command === 'tick') setModel(m => tick(m, 10000))
      if (command === 'resolve') {
        setJob(n => n + 1)
        log('Résolution demandée')
      }
      if (command === 'handover')
        setModel(m => {
          const next = structuredClone(m),
            w = next.game?.who
          if (w && next.game) {
            const id = next.game.players.find(p => p.id !== w.active)?.id ?? next.me
            w.active = id
            w.eligible = w.mode === 'duel' ? [id] : next.game.players.map(p => p.id)
            w.checking = []
            w.frozenAt = null
            delete next.game.ownAnswer
          }
          return next
        })
      if (command === 'connection')
        setModel(m => {
          const next = structuredClone(m)
          next.online = !m.online
          if (next.game?.solo) {
            if (next.online) resumeSolo(next.game.solo, 'away', next.now)
            else pauseSolo(next.game.solo, 'away', next.now)
          }
          if (next.game) {
            if (next.online) {
              next.game.deadline += next.game.pausedAt === null ? 0 : next.now - next.game.pausedAt
              next.game.pausedAt = null
              next.game.pausedUntil = null
              next.game.players.forEach(p => (p.absentSince = null))
            } else {
              next.game.pausedAt = next.now
              next.game.pausedUntil = next.now + 90000
            }
          }
          return next
        })
      if (command === 'celebrate') {
        setModel(m => {
          const next = structuredClone(m)
          if (next.game) {
            next.game.id = `lab-celebrate-${Date.now()}`
            next.game.phase = 'question'
            delete next.game.result
          }
          return next
        })
        if (celebration.current) clearTimeout(celebration.current)
        celebration.current = setTimeout(
          () =>
            setModel(m => {
              const next = structuredClone(m)
              if (next.game) {
                reveal(next, true)
                next.game.players.find(p => p.id === next.me)!.score += next.game.who?.points ?? 1
              }
              return next
            }),
          600
        )
      }
      log(command)
    }
    window.addEventListener('message', receive)
    return () => {
      window.removeEventListener('message', receive)
      if (celebration.current) clearTimeout(celebration.current)
    }
  }, [])
  function send(action: GameAction) {
    setModel(m => act(m, action))
    log(action.action)
    if (['start', 'answer', 'accept', 'decline'].includes(action.action)) setJob(n => n + 1)
    return true
  }
  function setOpen(open: boolean) {
    setModel(model => {
      const next = structuredClone(model)
      next.open = open
      next.selected = null
      if (next.game?.solo) {
        if (open) resumeSolo(next.game.solo, 'menu', next.now)
        else pauseSolo(next.game.solo, 'menu', next.now)
      }
      return next
    })
  }
  return (
    <div className="lab-world">
      <div className="lab-world-label">MONDE SIMULÉ · SANS MULTIJOUEUR</div>
      {!model.open && (
        <button className="lab-game-station" onClick={() => setOpen(true)}>
          <img src="./assets/games/terminal.webp" alt="" width="140" height="194" />
          <strong>
            ★{' '}
            {initialConfig.language === 'fr'
              ? 'Jouer · Solo ou ensemble'
              : 'Play · Solo or together'}
          </strong>
        </button>
      )}
      <BibleGamesView
        stationOnly
        snapshot={{ game: model.game, invitations: model.invitations, now: model.now }}
        me={model.me}
        online={model.online}
        error={model.error}
        now={model.now}
        language={initialConfig.language}
        open={model.open}
        options={model.options}
        setOptions={options => setModel(m => ({ ...m, options }))}
        selectedInvitation={model.selected}
        invitationIssue={model.invitationIssue}
        invitationAction={model.invitationAction}
        nearby={people.filter(p => !model.game?.players.some(member => member.id === p.id))}
        onOpen={() => setOpen(true)}
        close={() => setOpen(false)}
        selectInvitation={selected => {
          setModel(m => ({ ...m, selected, open: true }))
          log('Invitation ouverte')
        }}
        answerInvitation={action => {
          if (model.selected) send({ action, invitation: model.selected.id })
        }}
        send={send}
      />
      {!model.open && (
        <div className="lab-world-hint">La borne et les notifications restent interactives.</div>
      )}
    </div>
  )
}
function Gallery() {
  const [story, setStory] = useState<StoryId>(initialStory)
  const [frameStory, setFrameStory] = useState<StoryId>(initialStory)
  const [config, setConfig] = useState(initialConfig)
  const [size, setSize] = useState('mobile')
  const [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [clock, setClock] = useState(false)
  const [flow, setFlow] = useState<keyof typeof flows>('duel')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [events, setEvents] = useState<string[]>([])
  const frame = useRef<HTMLIFrameElement>(null)
  const current = stories.find(s => s[0] === story)!
  const dimensions =
    size === 'mobile'
      ? [390, 844]
      : size === 'compact'
        ? [390, 500]
        : size === 'tablet'
          ? [768, 900]
          : [1100, 900]
  const previewParams = new URLSearchParams({
    preview: '1',
    state: frameStory,
    lang: config.language,
    players: String(config.players),
    viewer: String(config.perspective),
    revision: String(revision),
  })
  const url = `/game-lab.html?${previewParams}`
  const soloParams = new URLSearchParams(previewParams)
  soloParams.set('state', story)
  function command(command: string, value?: unknown) {
    frame.current?.contentWindow?.postMessage({ signal, command, value }, location.origin)
  }
  function choose(id: StoryId) {
    setStory(id)
    setFrameStory(id)
    setClock(false)
    setPlaying(false)
    setEvents([])
  }
  function go(index: number) {
    const bounded = Math.max(0, Math.min(flows[flow].steps.length - 1, index))
    setStep(bounded)
    setStory(flows[flow].steps[bounded])
    command(bounded === 0 ? 'restart-story' : 'story', flows[flow].steps[bounded])
    setClock(false)
  }
  useEffect(() => {
    const search = new URLSearchParams({
      state: story,
      lang: config.language,
      players: String(config.players),
      viewer: String(config.perspective),
    })
    history.replaceState(null, '', `/game-lab.html?${search}`)
  }, [story, config])
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.signal !== signal ||
        typeof event.data.event !== 'string'
      )
        return
      setEvents(list => [event.data.event, ...list].slice(0, 8))
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      if (step >= flows[flow].steps.length - 1) setPlaying(false)
      else go(step + 1)
    }, 3500)
    return () => clearTimeout(timer)
  }, [playing, step, flow])
  const groups = [...new Set(stories.map(s => s[1]))]
  return (
    <div className="lab-app">
      <aside className="lab-sidebar">
        <a className="lab-brand" href="/game-lab.html">
          ✦{' '}
          <span>
            GAME LAB<small>Bible Strong · atelier UI</small>
          </span>
        </a>
        <label className="lab-search">
          Rechercher un état
          <input
            placeholder="Invitation, erreur, victoire…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <nav aria-label="États des jeux">
          {groups.map(group => (
            <section key={group}>
              <h2>{group}</h2>
              {stories
                .filter(
                  s =>
                    s[1] === group && `${s[1]} ${s[2]}`.toLowerCase().includes(query.toLowerCase())
                )
                .map(([id, , name]) => (
                  <button
                    key={id}
                    aria-current={story === id ? 'page' : undefined}
                    onClick={() => choose(id)}
                  >
                    {name}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <a className="lab-back" href="/">
          ← Ouvrir le monde
        </a>
      </aside>
      <main className="lab-main">
        <header className="lab-header">
          <div>
            <p>
              {current[1]} / {stories.length} états disponibles
            </p>
            <h1>{current[2]}</h1>
          </div>
          <span className="lab-badge">100 % local · sans IA</span>
        </header>
        <div className="lab-controls">
          <label>
            Format
            <select value={size} onChange={e => setSize(e.target.value)}>
              <option value="mobile">Mobile · 390 × 844</option>
              <option value="compact">Clavier · 390 × 500</option>
              <option value="tablet">Tablette · 768 × 900</option>
              <option value="desktop">Desktop · 1100 × 900</option>
            </select>
          </label>
          <label>
            Joueurs
            <select
              value={config.players}
              onChange={e => {
                setFrameStory(story)
                setConfig(c => ({ ...c, players: Number(e.target.value), perspective: 0 }))
                setClock(false)
              }}
            >
              {[2, 3, 4].map(n => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Point de vue
            <select
              value={config.perspective}
              onChange={e => {
                setFrameStory(story)
                setClock(false)
                setConfig(c => ({ ...c, perspective: Number(e.target.value) }))
              }}
            >
              {people.slice(0, config.players).map((p, i) => (
                <option key={p.id} value={i}>
                  {p.profile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Langue
            <select
              value={config.language}
              onChange={e => {
                setFrameStory(story)
                setClock(false)
                setConfig(c => ({ ...c, language: e.target.value === 'en' ? 'en' : 'fr' }))
              }}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          <a
            className="lab-preview-link"
            href={`/game-lab.html?${soloParams}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Aperçu seul ↗
          </a>
          <button
            onClick={() => {
              setFrameStory(story)
              setRevision(r => r + 1)
              setClock(false)
              setEvents([])
            }}
          >
            ↺ Recommencer
          </button>
        </div>
        <div className="lab-journey">
          <label>
            Parcours
            <select
              value={flow}
              onChange={e => {
                const selected = e.target.value as keyof typeof flows
                setFlow(selected)
                setStep(0)
                setPlaying(false)
                setStory(flows[selected].steps[0])
                setFrameStory(flows[selected].steps[0])
                setClock(false)
                if (selected === 'race') setConfig(c => ({ ...c, players: 4 }))
                if (selected === 'duel') setConfig(c => ({ ...c, players: 2, perspective: 0 }))
              }}
            >
              {Object.entries(flows).map(([id, f]) => (
                <option key={id} value={id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              go(0)
              setPlaying(true)
            }}
          >
            ▶ Lire le parcours
          </button>
          <button disabled={!playing} onClick={() => setPlaying(false)}>
            Pause
          </button>
          <button
            onClick={() => {
              setPlaying(false)
              go(step - 1)
            }}
          >
            ←
          </button>
          <span>
            {step + 1} / {flows[flow].steps.length}
          </span>
          <button
            onClick={() => {
              setPlaying(false)
              go(step + 1)
            }}
          >
            Étape suivante →
          </button>
        </div>
        <div className="lab-tools">
          <label>
            <input
              type="checkbox"
              checked={clock}
              onChange={e => {
                setClock(e.target.checked)
                command('clock', e.target.checked)
              }}
            />{' '}
            Faire tourner le chrono
          </label>
          <button onClick={() => command('tick')}>+10 secondes</button>
          <button onClick={() => command('handover')}>Passer la main</button>
          <button onClick={() => command('resolve')}>Résoudre l’attente</button>
          <button onClick={() => command('connection')}>Couper / rétablir le réseau</button>
          <button onClick={() => command('celebrate')}>★ Jouer la victoire</button>
        </div>
        <p className="lab-tip">
          Clique dans l’aperçu comme dans le jeu. « Moïse » ou « Moses » réussit ; « David » échoue
          ; « prophète » demande une précision. Le chrono est figé au départ pour observer chaque
          détail.
        </p>
        <div className="lab-stage">
          <iframe
            ref={frame}
            title="Aperçu interactif des jeux"
            src={url}
            style={{ width: dimensions[0], height: dimensions[1] }}
            onLoad={() => command('clock', clock)}
          />
        </div>
        <section className="lab-log" aria-label="Actions simulées">
          <strong>Dernières interactions</strong>
          {events.length ? (
            events.map((event, i) => <span key={`${i}:${event}`}>{event}</span>)
          ) : (
            <span>Les actions du jeu apparaîtront ici.</span>
          )}
        </section>
      </main>
    </div>
  )
}
if (import.meta.env.DEV) {
  const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
  if (!import.meta.hot?.data.haptics) installButtonHaptics()
  if (import.meta.hot) import.meta.hot.data.haptics = true
  if (import.meta.hot) import.meta.hot.data.root = root
  root.render(params.get('preview') === '1' ? <Frame /> : <Gallery />)
}
