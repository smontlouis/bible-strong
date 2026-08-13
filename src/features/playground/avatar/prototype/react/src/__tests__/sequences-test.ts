import {
  advanceSequenceCursor,
  createInitialSequences,
  getSequenceSpring,
  normalizeSequencesForExpressions,
  parseSequences,
  remapSequencesAfterExpressionDelete,
  remapSequencesAfterExpressionInsert,
} from '../sequences'

describe('editable avatar sequences', () => {
  it('migrates the existing idle state into editable steps and blink settings', () => {
    const idle = createInitialSequences().find(sequence => sequence.id === 'idle')

    expect(idle?.steps.map(step => step.expressionIndex)).toEqual([0, 8])
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

  it('keeps sequence references stable when expressions are inserted or deleted', () => {
    const sequence = createInitialSequences().find(item => item.id === 'idle')!
    const inserted = remapSequencesAfterExpressionInsert([sequence], 0)[0]
    const restored = remapSequencesAfterExpressionDelete([inserted], 0)[0]

    expect(inserted.steps.map(step => step.expressionIndex)).toEqual([1, 9])
    expect(restored.steps.map(step => step.expressionIndex)).toEqual([0, 8])
  })

  it('keeps a sequence playable when its only referenced expression is deleted', () => {
    const sequence = createInitialSequences().find(item => item.id === 'waking')!
    const [remapped] = remapSequencesAfterExpressionDelete([sequence], 13)

    expect(remapped.steps).toHaveLength(1)
    expect(remapped.steps[0].expressionIndex).toBe(12)
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
      [{ ...sequence, steps: [{ ...sequence.steps[0], expressionIndex: 99 }] }],
      4
    )

    expect(normalized.steps[0].expressionIndex).toBe(3)
  })

  it('maps transition styles and durations to distinct spring dynamics', () => {
    const smooth = getSequenceSpring('smooth', 900, 7)
    const snappy = getSequenceSpring('snappy', 250, 7)

    expect(snappy.stiffness).toBeGreaterThan(smooth.stiffness)
    expect(smooth.damping).toBeGreaterThan(0)
  })
})
