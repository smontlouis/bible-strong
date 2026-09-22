import { describe, expect, it } from 'vitest'
import { countdownStep, GO_MS, inCountdown } from './game-juice'
import { START_DELAY_MS } from './games-protocol'

describe('3 · 2 · 1 · Go! cadence', () => {
  it('shows each number for one second and ends "Go!" when the question opens', () => {
    const shown: string[] = []
    const steps = ['3', '2', '1', 'Go']
    // Walk the schedule the way the component does, from the moment the question arrives.
    let remaining = START_DELAY_MS
    let elapsed = 0
    const timeline: [number, string][] = []
    for (;;) {
      const step = countdownStep(remaining, 3)
      if (step.done) break
      if (shown.at(-1) !== steps[step.index]) {
        timeline.push([elapsed, steps[step.index]])
        shown.push(steps[step.index])
      }
      remaining -= step.wait
      elapsed += step.wait
    }
    expect(shown).toEqual(['3', '2', '1', 'Go'])
    expect(elapsed).toBe(START_DELAY_MS)
    const go = timeline.find(([, label]) => label === 'Go')![0]
    expect(START_DELAY_MS - go).toBe(GO_MS)
    const one = timeline.find(([, label]) => label === '1')![0]
    expect(go - one).toBe(1000)
  })
  it('never holds an already open question', () => {
    expect(countdownStep(0, 3)).toEqual({ done: true })
    expect(countdownStep(-800, 3)).toEqual({ done: true })
  })
  it('stops counting once the first question is open or the game moved on', () => {
    expect(inCountdown('generating', 0, undefined, 10)).toBe(true)
    expect(inCountdown('question', 0, 5_000, 4_999)).toBe(true)
    expect(inCountdown('question', 0, 5_000, 5_000)).toBe(false)
    expect(inCountdown('question', 1, 5_000, 4_000)).toBe(false)
    expect(inCountdown('reveal', 0, 5_000, 4_000)).toBe(false)
  })
})
