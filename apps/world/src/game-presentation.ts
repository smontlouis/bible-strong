import type { GameView } from './games-protocol'

/** Presentation only: eligibility and points always come from the room. */
export function turnPresentation(game: GameView, me: string | null, online: boolean) {
  const w = game.who!
  const own = game.ownAnswer?.zone === w.zone ? game.ownAnswer : undefined
  if (!online) return 'offline'
  if (game.pausedAt !== null) return 'paused'
  if (own?.status === 'pending') return 'checking'
  if (own?.status === 'unavailable') return own.retriesLeft > 0 ? 'unavailable' : 'blocked'
  if (own?.status === 'clarify') return own.retriesLeft > 0 ? 'clarify' : 'blocked'
  if (own?.status === 'wrong') return 'wrong'
  if (w.checking.length) return 'checkingOther'
  if (me !== null && w.eligible.includes(me)) return w.mode === 'race' ? 'race' : 'ready'
  return w.mode === 'race' ? 'blocked' : 'waiting'
}

export function gameStandings(game: GameView) {
  return [...game.players]
    .sort((a, b) => b.score - a.score)
    .map((player, _, sorted) => ({
      ...player,
      rank: sorted.findIndex(p => p.score === player.score) + 1,
    }))
}

export function roundOutcome(game: GameView, me: string | null) {
  if (!game.result || game.result.void) return 'void'
  if (game.who) {
    if (!game.who.winner) return 'missed'
    return game.who.winner === me ? 'win' : 'other'
  }
  return game.result.answers.some(a => a.id === me && a.status === 'correct') ? 'win' : 'missed'
}

export function awardedPoints(game: GameView, player: string) {
  if (!game.result || game.result.void) return 0
  if (game.who) return game.who.winner === player ? (game.who.awarded ?? 0) : 0
  return game.result.answers.some(a => a.id === player && a.status === 'correct') ? 1 : 0
}
