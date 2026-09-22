import { describe, expect, it } from 'vitest'
import { awardedPoints, gameStandings, roundOutcome, turnPresentation } from './game-presentation'
import type { GameView } from './games-protocol'

function fixture(): GameView {
  return {
    id: 'test',
    host: 'a',
    phase: 'question',
    round: 0,
    total: 5,
    options: {
      kind: 'who',
      subject: 'people',
      testament: 'both',
      difficulty: 'easy',
      language: 'fr',
    },
    players: ['a', 'b', 'c'].map((id, i) => ({
      id,
      profile: { name: id, avatar: 'nova', color: '#aa77dd' },
      score: i === 2 ? 2 : 4,
      absentSince: null,
    })),
    pausedAt: null,
    pausedUntil: null,
    deadline: 20000,
    invited: [],
    answered: [],
    who: {
      mode: 'duel',
      zone: 1,
      points: 3,
      active: 'a',
      eligible: ['a'],
      checking: [],
      frozenAt: null,
    },
  }
}
describe('game presentation follows room authority', () => {
  it('gives disconnection and pause priority over an eligible turn', () => {
    const game = fixture()
    expect(turnPresentation(game, 'a', false)).toBe('offline')
    game.pausedAt = 1000
    expect(turnPresentation(game, 'a', true)).toBe('paused')
  })
  it('keeps a previous clue error out of the new clue banner', () => {
    const game = fixture()
    game.ownAnswer = { zone: 0, status: 'wrong', text: 'David', retriesLeft: 2 }
    expect(turnPresentation(game, 'a', true)).toBe('ready')
    game.ownAnswer.zone = 1
    expect(turnPresentation(game, 'a', true)).toBe('wrong')
  })
  it('distinguishes turn, race, exhausted attempt and another answer being checked', () => {
    const game = fixture()
    expect(turnPresentation(game, 'b', true)).toBe('waiting')
    game.who!.mode = 'race'
    expect(turnPresentation(game, 'a', true)).toBe('race')
    expect(turnPresentation(game, 'b', true)).toBe('blocked')
    game.who!.checking = ['a']
    expect(turnPresentation(game, 'b', true)).toBe('checkingOther')
  })
  it('never presents clarification or provider failure as a wrong answer', () => {
    const game = fixture()
    game.ownAnswer = { zone: 1, status: 'unavailable', text: 'Moise', retriesLeft: 2 }
    expect(turnPresentation(game, 'a', true)).toBe('unavailable')
    game.ownAnswer.status = 'clarify'
    expect(turnPresentation(game, 'a', true)).toBe('clarify')
    game.ownAnswer.retriesLeft = 0
    expect(turnPresentation(game, 'a', true)).toBe('blocked')
  })
  it('ranks tied players equally without mutating player display order', () => {
    const game = fixture()
    expect(gameStandings(game).map(p => p.rank)).toEqual([1, 1, 3])
    expect(game.players.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })
  it('does not celebrate an annulled round or an absent winner', () => {
    const game = fixture()
    game.result = {
      answer: 'Moïse',
      explanation: '',
      reference: '',
      url: '',
      void: false,
      answers: [],
    }
    expect(roundOutcome(game, 'a')).toBe('missed')
    game.who!.winner = 'b'
    expect(roundOutcome(game, 'a')).toBe('other')
    expect(roundOutcome(game, 'b')).toBe('win')
    game.who!.awarded = 3
    game.result.answers = [
      { id: 'a', text: 'Moïse', status: 'correct' },
      { id: 'b', text: 'Moïse', status: 'correct' },
    ]
    expect(awardedPoints(game, 'a')).toBe(0)
    expect(awardedPoints(game, 'b')).toBe(3)
    game.result.void = true
    expect(roundOutcome(game, 'b')).toBe('void')
  })
})
