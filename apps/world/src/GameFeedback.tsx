import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AvatarPreview } from './AvatarEditor'
import type { GameView } from './games-protocol'
import { gameStandings, roundOutcome } from './game-presentation'
import { Burst, Confetti, PunchNumber, SparkleIcon, StarIcon, flyTo } from './game-juice'
import { haptic } from './haptics'

// A repeated snapshot or reopening the widget must not celebrate the same points twice.
const celebrated = new Set<string>()
function remember(key: string) {
  if (celebrated.has(key)) return false
  celebrated.add(key)
  if (celebrated.size > 100) celebrated.delete(celebrated.values().next().value!)
  return true
}
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
    if (!arrived || game.result?.void || !remember(key)) return
    setBurst(true)
    const timer = setTimeout(() => setBurst(false), 2600)
    return () => clearTimeout(timer)
  }, [game.id, game.phase, game.round, game.result?.void])
  return burst
}

export function GameFeedback({
  game,
  me,
  onShake,
}: {
  game: GameView
  me: string | null
  onShake?: () => void
}) {
  const animate = useCelebration(game)
  const panel = useRef<HTMLElement>(null)
  const pop = useRef<HTMLElement>(null)
  const outcome = game.phase === 'reveal' && game.result ? roundOutcome(game, me) : null
  const points = game.who?.awarded ?? 1
  const winnerId = game.who ? game.who.winner : me
  useEffect(() => {
    if (game.phase === 'reveal') panel.current?.scrollIntoView({ block: 'nearest' })
  }, [game.phase])
  useEffect(() => {
    // The room already awarded the points; the interface only shows them travelling.
    if (!animate || !outcome) return
    if (outcome === 'win') {
      haptic(points >= 3 ? 'win' : 'success')
      const target = panel.current
        ?.closest('.games-shell')
        ?.querySelector<HTMLElement>(`[data-score-for="${winnerId}"]`)
      const timer = setTimeout(() => flyTo(pop.current, target ?? null, `+${points}`), 500)
      return () => clearTimeout(timer)
    }
    if (outcome === 'other') {
      haptic('nudge')
      const target = panel.current
        ?.closest('.games-shell')
        ?.querySelector<HTMLElement>(`[data-score-for="${winnerId}"]`)
      const timer = setTimeout(() => flyTo(pop.current, target ?? null, `+${points}`), 500)
      return () => clearTimeout(timer)
    }
    if (outcome === 'missed') {
      haptic('error')
      onShake?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, outcome])
  if (game.phase !== 'reveal' || !game.result || !outcome) return null
  const fr = game.options.language === 'fr'
  const winner = game.players.find(p => p.id === game.who?.winner)
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
  const scored = outcome === 'win' || outcome === 'other'
  return (
    <section
      ref={panel}
      className="game-outcome"
      data-outcome={outcome}
      data-burst={animate}
      role="status"
    >
      {animate && outcome === 'win' && <Confetti seed={`${game.id}:${game.round}`} count={80} />}
      {animate && scored && (
        <Burst seed={`${game.id}:${game.round}`} count={outcome === 'win' ? 30 : 16} spread={150} />
      )}
      <span className="game-outcome-icon" aria-hidden="true">
        {outcome === 'void' ? 'Ⅱ' : scored ? <StarIcon /> : <SparkleIcon />}
      </span>
      <div>
        <strong>{title}</strong>
        <p>
          {outcome === 'void'
            ? fr
              ? 'Aucun point perdu. On continue ensemble.'
              : 'No points lost. Let’s keep going.'
            : scored
              ? fr
                ? 'Les points rejoignent le score !'
                : 'Points added to the score!'
              : fr
                ? 'Une découverte de plus à partager.'
                : 'One more discovery to share.'}
        </p>
      </div>
      {scored && (
        <b className="game-points-pop" ref={pop}>
          +{points}
          <small>PTS</small>
        </b>
      )}
    </section>
  )
}

export function GameFinale({ game, me }: { game: GameView; me: string | null }) {
  const panel = useRef<HTMLElement>(null)
  const [celebrate, setCelebrate] = useState(false)
  const fr = game.options.language === 'fr'
  const standings = gameStandings(game)
  const leaders = standings.filter(p => p.rank === 1)
  const interrupted = !!game.reason
  const noPoints = standings.every(p => p.score === 0)
  const podium = !interrupted && !noPoints
  const iWin = podium && leaders.some(p => p.id === me)
  const total = standings.length
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    if (!remember(`${game.id}:finale`)) return
    // The podium reveals last place first; the leader lands with the celebration.
    const delay = 400 + total * 320
    const timer = setTimeout(() => {
      haptic(iWin ? 'win' : podium ? 'success' : 'nudge')
      if (podium) setCelebrate(true)
    }, delay)
    const stop = setTimeout(() => setCelebrate(false), delay + 4500)
    return () => {
      clearTimeout(timer)
      clearTimeout(stop)
    }
  }, [game.id, iWin, podium, total])
  return (
    <section ref={panel} className="game-finale" data-podium={podium}>
      {celebrate && <Confetti seed={`${game.id}:finale`} count={110} />}
      <div className="game-trophy juice-bounce-in" aria-hidden="true">
        {interrupted ? 'Ⅱ' : noPoints ? <SparkleIcon /> : <StarIcon />}
        {podium && <Burst seed={`${game.id}:trophy`} count={20} spread={110} />}
      </div>
      <h2 className="juice-stamp">
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
        {standings.map((p, index) => (
          <li
            key={p.id}
            data-leader={podium && p.rank === 1}
            data-me={p.id === me}
            style={{ '--i': total - 1 - index } as CSSProperties}
          >
            <span className="game-rank">{p.rank}</span>
            <AvatarPreview avatar={p.profile.avatar} color={p.profile.color} />
            <strong>
              {p.profile.name}
              {p.id === me ? (fr ? ' · Toi' : ' · You') : ''}
            </strong>
            <b>
              <PunchNumber
                value={p.score}
                from={0}
                duration={700}
                delay={300 + (total - 1 - index) * 320}
              />
              <small>PTS</small>
            </b>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function GameScore({ value }: { value: number }) {
  return <PunchNumber value={value} />
}
