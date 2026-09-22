import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AvatarPreview } from './AvatarEditor'
import type { GameView } from './games-protocol'
import { gameStandings, roundOutcome } from './game-presentation'

// A repeated snapshot or reopening the widget must not celebrate the same points twice.
const celebrated = new Set<string>()
function useCelebration(game: GameView) {
  const previous = useRef(game.phase)
  const [burst, setBurst] = useState(false)
  useEffect(() => {
    const key = `${game.id}:${game.round}`
    const arrived = previous.current === 'question' && game.phase === 'reveal'
    previous.current = game.phase
    if (game.phase !== 'reveal') {
      setBurst(false)
      return
    }
    if (!arrived || celebrated.has(key) || game.result?.void) return
    celebrated.add(key)
    if (celebrated.size > 100) celebrated.delete(celebrated.values().next().value!)
    setBurst(true)
    const timer = setTimeout(() => setBurst(false), 2000)
    return () => clearTimeout(timer)
  }, [game.id, game.phase, game.round, game.result?.void])
  return burst
}

export function GameFeedback({ game, me }: { game: GameView; me: string | null }) {
  const animate = useCelebration(game)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (game.phase === 'reveal') panel.current?.scrollIntoView({ block: 'nearest' })
  }, [game.phase])
  if (game.phase !== 'reveal' || !game.result) return null
  const fr = game.options.language === 'fr'
  const outcome = roundOutcome(game, me)
  const winner = game.players.find(p => p.id === game.who?.winner)
  const points = game.who?.awarded ?? 1
  const title =
    outcome === 'void'
      ? fr
        ? 'Manche annulée'
        : 'Round cancelled'
      : outcome === 'win'
        ? fr
          ? 'Bien trouvé !'
          : 'You got it!'
        : outcome === 'other'
          ? fr
            ? `${winner?.profile.name ?? 'Un autre joueur'} a trouvé !`
            : `${winner?.profile.name ?? 'Another player'} got it!`
          : game.who
            ? fr
              ? 'Mystère révélé !'
              : 'Mystery revealed!'
            : fr
              ? 'Pas cette fois !'
              : 'Not this time!'
  return (
    <section
      ref={panel}
      className="game-outcome"
      data-outcome={outcome}
      data-burst={animate}
      role="status"
    >
      {animate && (outcome === 'win' || outcome === 'other') && (
        <div className="game-sparkles" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties}>
              ✦
            </i>
          ))}
        </div>
      )}
      <span className="game-outcome-icon" aria-hidden="true">
        {outcome === 'void' ? 'Ⅱ' : outcome === 'win' || outcome === 'other' ? '★' : '✦'}
      </span>
      <div>
        <strong>{title}</strong>
        <p>
          {outcome === 'void'
            ? fr
              ? 'Aucun point perdu. On continue ensemble.'
              : 'No points lost. Let’s keep going.'
            : outcome === 'win' || outcome === 'other'
              ? fr
                ? 'Les points rejoignent le score !'
                : 'Points added to the score!'
              : fr
                ? 'Une découverte de plus à partager.'
                : 'One more discovery to share.'}
        </p>
      </div>
      {(outcome === 'win' || outcome === 'other') && (
        <b className="game-points-pop">
          +{points}
          <small>PTS</small>
        </b>
      )}
    </section>
  )
}

export function GameFinale({ game, me }: { game: GameView; me: string | null }) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'start' })
  }, [])
  const fr = game.options.language === 'fr'
  const standings = gameStandings(game)
  const leaders = standings.filter(p => p.rank === 1)
  const interrupted = !!game.reason
  const noPoints = standings.every(p => p.score === 0)
  return (
    <section ref={panel} className="game-finale">
      <div className="game-trophy" aria-hidden="true">
        {interrupted ? 'Ⅱ' : noPoints ? '✦' : '★'}
      </div>
      <h2>
        {interrupted
          ? fr
            ? 'Partie interrompue'
            : 'Game interrupted'
          : noPoints
            ? fr
              ? 'Cinq découvertes ensemble !'
              : 'Five discoveries together!'
            : leaders.length > 1
              ? fr
                ? 'Victoire partagée !'
                : 'A shared victory!'
              : leaders[0]?.id === me
                ? fr
                  ? 'Tu remportes la partie !'
                  : 'You win the game!'
                : fr
                  ? `${leaders[0]?.profile.name} remporte la partie !`
                  : `${leaders[0]?.profile.name} wins!`}
      </h2>
      <p>
        {fr
          ? 'Chaque découverte compte. Merci d’avoir joué ensemble !'
          : 'Every discovery counts. Thanks for playing together!'}
      </p>
      <ol className="game-ranking">
        {standings.map(p => (
          <li key={p.id} data-leader={!interrupted && !noPoints && p.rank === 1}>
            <span className="game-rank">{p.rank}</span>
            <AvatarPreview avatar={p.profile.avatar} color={p.profile.color} />
            <strong>
              {p.profile.name}
              {p.id === me ? (fr ? ' · Toi' : ' · You') : ''}
            </strong>
            <b>
              {p.score}
              <small>PTS</small>
            </b>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function GameScore({ value }: { value: number }) {
  const previous = useRef(value)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (value <= from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 550)
      setShown(Math.round(from + (value - from) * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span aria-label={String(value)} className="game-score-counter">
      <span aria-hidden="true">{shown}</span>
    </span>
  )
}
