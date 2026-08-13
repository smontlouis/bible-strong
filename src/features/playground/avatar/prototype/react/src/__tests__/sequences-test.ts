import {
  advanceSequenceCursor,
  createInitialSequences,
  getSequenceSpring,
  normalizeSequencesForExpressions,
  parseSequences,
  remapSequencesAfterExpressionDelete,
} from '../sequences'
import { initialExpressions } from '../presets'

describe('editable avatar sequences', () => {
  it('migrates the existing idle state into editable steps and blink settings', () => {
    const idle = createInitialSequences().find(sequence => sequence.id === 'idle')

    expect(idle?.steps.map(step => step.expressionId)).toEqual([
      initialExpressions[0].id,
      initialExpressions[8].id,
    ])
    expect(idle?.steps[0].holdMs).toBe(5200)
    expect(idle?.blink.durationMs).toBe(280)
  })

  it('supports loop, once and ping-pong playback cursors', () => {
    const base = createInitialSequences().find(sequence => sequence.id === 'listening')!

    expect(advanceSequenceCursor({ ...base, playbackMode: 'loop' }, 2, 1)).toEqual({
      index: 0,
      direction: 1,
      complete: false,
    })
    expect(advanceSequenceCursor({ ...base, playbackMode: 'once' }, 2, 1).complete).toBe(true)
    expect(advanceSequenceCursor({ ...base, playbackMode: 'pingPong' }, 2, 1)).toEqual({
      index: 1,
      direction: -1,
      complete: false,
    })
  })

  it('keeps sequence references stable when expressions are reordered', () => {
    const sequence = createInitialSequences().find(item => item.id === 'idle')!
    const reordered = [...initialExpressions].reverse()
    const [normalized] = normalizeSequencesForExpressions([sequence], reordered)

    expect(normalized.steps.map(step => step.expressionId)).toEqual(
      sequence.steps.map(step => step.expressionId)
    )
  })

  it('keeps a sequence playable when its only referenced expression is deleted', () => {
    const sequence = createInitialSequences().find(item => item.id === 'waking')!
    const fallbackId = initialExpressions[12].id
    const [remapped] = remapSequencesAfterExpressionDelete(
      [sequence],
      initialExpressions[13].id,
      fallbackId
    )

    expect(remapped.steps).toHaveLength(1)
    expect(remapped.steps[0].expressionId).toBe(fallbackId)
  })

  it('sanitizes persisted timing values and invalid playback values', () => {
    const [sequence] = parseSequences([
      {
        id: 'custom',
        name: 'Custom',
        playbackMode: 'invalid',
        steps: [{ expressionIndex: 2, holdMs: -5, transitionMs: 99999 }],
        blink: { minIntervalMs: 9000, maxIntervalMs: 1000, durationMs: 2 },
      },
    ])

    expect(sequence.playbackMode).toBe('loop')
    expect(sequence.steps[0].holdMs).toBe(100)
    expect(sequence.steps[0].transitionMs).toBe(5000)
    expect(sequence.blink.maxIntervalMs).toBe(sequence.blink.minIntervalMs)
    expect(sequence.blink.durationMs).toBe(40)
  })

  it('repairs missing and out-of-range expression references on load', () => {
    const sequence = createInitialSequences().find(item => item.id === 'idle')!
    const [normalized] = normalizeSequencesForExpressions(
      [{ ...sequence, steps: [{ ...sequence.steps[0], expressionId: 'missing' }] }],
      initialExpressions.slice(0, 4)
    )

    expect(normalized.steps[0].expressionId).toBe(initialExpressions[0].id)
  })

  it('maps transition styles and durations to distinct spring dynamics', () => {
    const smooth = getSequenceSpring('smooth', 900, 7)
    const snappy = getSequenceSpring('snappy', 250, 7)

    expect(snappy.stiffness).toBeGreaterThan(smooth.stiffness)
    expect(smooth.damping).toBeGreaterThan(0)
  })
})
