import { advanceSequenceCursor, type AvatarSequence } from './sequences'

export type PlaybackTimeline = {
  position: number
  direction: 1 | -1
  stepDueAt: number | null
  stepRemainingMs: number
  blinkDueAt: number | null
  blinkRemainingMs: number
}

export const createPlaybackTimeline = (): PlaybackTimeline => ({
  position: 0,
  direction: 1,
  stepDueAt: null,
  stepRemainingMs: 0,
  blinkDueAt: null,
  blinkRemainingMs: 0,
})

export const beginPlayback = (timeline: PlaybackTimeline, preservePosition = false) => {
  return {
    ...timeline,
    position: preservePosition ? timeline.position : 0,
    direction: preservePosition ? timeline.direction : 1,
    stepDueAt: null,
    blinkDueAt: null,
  } satisfies PlaybackTimeline
}

export const schedulePlaybackStep = (timeline: PlaybackTimeline, now: number, delayMs: number) => {
  return { ...timeline, stepRemainingMs: delayMs, stepDueAt: now + delayMs }
}

export const schedulePlaybackBlink = (timeline: PlaybackTimeline, now: number, delayMs: number) => {
  return { ...timeline, blinkRemainingMs: delayMs, blinkDueAt: now + delayMs }
}

export const pausePlaybackTimeline = (timeline: PlaybackTimeline, now: number) => {
  return {
    ...timeline,
    stepRemainingMs:
      timeline.stepDueAt === null
        ? timeline.stepRemainingMs
        : Math.max(timeline.stepDueAt - now, 0),
    blinkRemainingMs:
      timeline.blinkDueAt === null
        ? timeline.blinkRemainingMs
        : Math.max(timeline.blinkDueAt - now, 0),
    stepDueAt: null,
    blinkDueAt: null,
  }
}

export const advancePlaybackTimeline = (timeline: PlaybackTimeline, sequence: AvatarSequence) => {
  const cursor = advanceSequenceCursor(sequence, timeline.position, timeline.direction)
  return {
    cursor,
    timeline: {
      ...timeline,
      position: cursor.index,
      direction: cursor.direction,
      stepDueAt: null,
    },
  }
}

export const stopPlaybackTimeline = (_timeline: PlaybackTimeline) => createPlaybackTimeline()
