import { createInitialSequences } from '../sequences'
import {
  advancePlaybackTimeline,
  beginPlayback,
  createPlaybackTimeline,
  pausePlaybackTimeline,
  schedulePlaybackBlink,
  schedulePlaybackStep,
} from '../playback'

describe('State playback timeline', () => {
  it('preserves the current sequence position when the avatar changes', () => {
    const timeline = createPlaybackTimeline()
    timeline.position = 1
    timeline.direction = -1

    const preserved = beginPlayback(timeline, true)

    expect(preserved.position).toBe(1)
    expect(preserved.direction).toBe(-1)
  })

  it('pauses and resumes from the exact remaining delays', () => {
    const timeline = createPlaybackTimeline()
    const scheduledStep = schedulePlaybackStep(timeline, 1_000, 500)
    const scheduled = schedulePlaybackBlink(scheduledStep, 1_000, 900)

    const paused = pausePlaybackTimeline(scheduled, 1_200)

    expect(paused.stepRemainingMs).toBe(300)
    expect(paused.blinkRemainingMs).toBe(700)
  })

  it('owns cursor advancement for the active State', () => {
    const idle = createInitialSequences().find(sequence => sequence.id === 'idle')!
    const timeline = createPlaybackTimeline()

    const result = advancePlaybackTimeline(timeline, idle)

    expect(result.cursor.complete).toBe(false)
    expect(result.timeline.position).toBe(1)
  })
})
