import { describe, expect, it } from 'vitest'
import { act, makeStory, settle, stories } from './game-lab/stories'
import { turnPresentation, awardedPoints } from './game-presentation'

const config = { language: 'fr' as const, players: 2, perspective: 0 }
describe('Game Lab fixtures and interactions', () => {
  it('constructs every state in both languages and for 2–4 players', () => {
    for (const [id] of stories)
      for (const language of ['fr', 'en'] as const)
        for (const players of [2, 3, 4]) {
          const model = makeStory(id, { language, players, perspective: players - 1 }, 1000)
          expect(model.now).toBe(1000)
          if (model.game) {
            expect(model.game.players.some(p => p.id === model.me)).toBe(true)
            expect(model.game.options.language).toBe(language)
          }
        }
  })
  it('changes the observer without moving the turn or winner to that observer', () => {
    const first = makeStory('your-turn', config, 1000)
    const second = makeStory('your-turn', { ...config, perspective: 1 }, 1000)
    expect(second.game!.who!.active).toBe(first.game!.who!.active)
    expect(turnPresentation(second.game!, second.me, true)).toBe('waiting')
    const result = makeStory('win', { ...config, perspective: 1 }, 1000)
    expect(result.game!.who!.winner).not.toBe(result.me)
    expect(result.game!.ownAnswer!.status).toBe('wrong')
  })
  it('allows a spelling-normalized answer and an animated score transition without a provider', () => {
    const initial = makeStory('your-turn', config, 1000)
    const pending = act(initial, {
      action: 'answer',
      gameId: initial.game!.id,
      round: 1,
      text: 'Moise',
      zone: 0,
    })
    expect(pending.game!.ownAnswer!.status).toBe('pending')
    const result = settle(pending)
    expect(result.game!.phase).toBe('reveal')
    expect(awardedPoints(result.game!, result.me)).toBe(4)
    expect(result.game!.players[0].score).toBe(8)
    expect(initial.game!.phase).toBe('question')
  })
  it('keeps clarification eligible and passes the hand on a wrong answer', () => {
    const initial = makeStory('your-turn', config, 1000)
    const submit = (text: string) =>
      settle(act(initial, { action: 'answer', gameId: initial.game!.id, round: 1, text, zone: 0 }))
    const clarify = submit('prophète')
    expect(turnPresentation(clarify.game!, clarify.me, true)).toBe('clarify')
    expect(clarify.game!.who!.eligible).toContain(clarify.me)
    const wrong = submit('David')
    expect(turnPresentation(wrong.game!, wrong.me, true)).toBe('wrong')
    expect(wrong.game!.who!.eligible).not.toContain(wrong.me)
  })
  it('accepts the selected invitation and declines only the selected card', () => {
    const initial = makeStory('notifications', config, 1000)
    initial.selected = initial.invitations[1]
    const accepted = settle(act(initial, { action: 'accept', invitation: initial.selected.id }))
    expect(accepted.game!.id).toBe(initial.selected.gameId)
    expect(accepted.game!.options.kind).toBe('quiz')
    const declined = settle(act(initial, { action: 'decline', invitation: initial.selected.id }))
    expect(declined.invitations).toHaveLength(2)
    expect(declined.selected).toBeNull()
    expect(initial.invitations).toHaveLength(3)
  })
  it('refuses to accept an expired invitation', () => {
    const expired = makeStory('invitation-expired', config, 1000)
    const result = act(expired, { action: 'accept', invitation: expired.selected!.id })
    expect(result.invitationIssue).toBe('expired')
    expect(result.game).toBeNull()
  })
})

it('runs a solo streak and resets it on a wrong answer without needing other players', () => {
  let m = makeStory('solo-question', config, 1000)
  expect(m.game!.players).toHaveLength(1)
  m = settle(act(m, { action: 'answer', gameId: m.game!.id, round: m.game!.round, text: 'Moïse' }))
  expect(m.game!.solo!.streak).toBe(3)
  expect(m.game!.phase).toBe('question')
  expect(m.game!.solo!.pauses).toEqual([])
  expect(m.game!.soloReview).toBeUndefined()
  m = settle(act(m, { action: 'answer', gameId: m.game!.id, round: m.game!.round, text: 'David' }))
  expect(m.game!.solo!.streak).toBe(0)
  expect(m.game!.solo!.best).toBe(3)
})
