import { describe, expect, it } from 'vitest'
import {
  createSoloRun,
  pauseSolo,
  resumeSolo,
  settleSolo,
  soloRemaining,
  submitSolo,
  tickSolo,
} from './solo-game'

function ready() {
  const run = createSoloRun()
  resumeSolo(run, 'preparing', 1000)
  return run
}

describe('four consecutive answers, active-time solo challenge', () => {
  it('requires four consecutive successes and retains the best after a mistake', () => {
    const run = ready()
    for (const [i, status] of [
      'correct',
      'correct',
      'wrong',
      'correct',
      'correct',
      'correct',
      'correct',
    ].entries()) {
      expect(submitSolo(run, `op-${i}`, 2000 + i * 2000)).toBe(true)
      settleSolo(run, `op-${i}`, status as 'correct' | 'wrong', 2500 + i * 2000)
      if (i === 2) expect([run.streak, run.best]).toEqual([0, 2])
      resumeSolo(run, 'feedback', 3000 + i * 2000)
    }
    expect(run.outcome).toBe('won')
    expect(run.answered).toBe(7)
    expect(submitSolo(run, 'extra', 999999)).toBe(false)
  })

  it('freezes once across overlapping evaluation, absence and feedback pauses', () => {
    const run = ready()
    submitSolo(run, 'a', 11000)
    pauseSolo(run, 'away', 12000)
    settleSolo(run, 'a', 'correct', 15000)
    resumeSolo(run, 'feedback', 20000)
    expect(soloRemaining(run, 90000)).toBe(110000)
    resumeSolo(run, 'away', 90000)
    resumeSolo(run, 'away', 95000)
    expect(soloRemaining(run, 100000)).toBe(100000)
  })

  it('does not penalize technical failures, ambiguity, or delayed duplicate verdicts', () => {
    const run = ready()
    submitSolo(run, 'a', 2000)
    expect(submitSolo(run, 'b', 2001)).toBe(false)
    expect(settleSolo(run, 'old', 'wrong', 3000)).toBe(false)
    settleSolo(run, 'a', 'unavailable', 14000)
    expect([run.streak, run.answered, soloRemaining(run, 50000)]).toEqual([0, 0, 119000])
    resumeSolo(run, 'technical', 50000)
    submitSolo(run, 'b', 51000)
    expect(settleSolo(run, 'a', 'correct', 51001)).toBe(false)
    settleSolo(run, 'b', 'clarify', 52000)
    expect(run.answered).toBe(0)
  })

  it('rejects answers at the deadline, but honours submissions before it', () => {
    const expired = ready()
    expect(submitSolo(expired, 'late', 121000)).toBe(false)
    expect(expired.outcome).toBe('timeout')
    const run = ready()
    expect(submitSolo(run, 'just-in-time', 120999)).toBe(true)
    tickSolo(run, 150000)
    expect(settleSolo(run, 'just-in-time', 'correct', 160000)).toBe(true)
    expect(run.remainingMs).toBe(1)
    expect(run.streak).toBe(1)
  })

  it('survives persistence while paused and counts a deliberate pass as a broken series', () => {
    const original = ready()
    original.streak = original.best = 3
    pauseSolo(original, 'away', 5000)
    const run = JSON.parse(JSON.stringify(original)) as typeof original
    resumeSolo(run, 'away', 900000)
    submitSolo(run, 'pass', 901000)
    settleSolo(run, 'pass', 'skipped', 901000)
    expect([run.streak, run.best, run.remainingMs]).toEqual([0, 3, 115000])
  })
})
