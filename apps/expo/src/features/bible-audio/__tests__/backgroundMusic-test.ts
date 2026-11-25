import type { BibleAudioState } from '../types'
import { getMusicTargetVolume, UNDER_VOICE } from '../backgroundMusic'

jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }))
jest.mock('../audioCatalog', () => ({}))
jest.mock('../atoms', () => ({}))

const state = (status: BibleAudioState['status'], passage = true) =>
  ({
    passage: passage ? { version: 'LSG', chapter: 1 } : null,
    source: 'recorded',
    recordingId: 'r',
    status,
  }) as BibleAudioState

describe('getMusicTargetVolume', () => {
  it('plays the music at its own volume while no voice speaks', () => {
    expect(getMusicTargetVolume(true, 0.6, state('idle', false), false)).toBe(0.6)
    expect(getMusicTargetVolume(true, 0.6, state('paused'), false)).toBe(0.6)
  })

  it('fades down under a voice, and out under a chapter that has music', () => {
    expect(getMusicTargetVolume(true, 0.6, state('playing'), false)).toBeCloseTo(0.6 * UNDER_VOICE)
    expect(getMusicTargetVolume(true, 0.6, state('loading'), false)).toBeCloseTo(0.6 * UNDER_VOICE)
    expect(getMusicTargetVolume(true, 0.6, state('playing'), true)).toBe(0)
  })

  it('stays silent while the reader has paused or closed it', () => {
    expect(getMusicTargetVolume(false, 0.6, state('playing'), false)).toBe(0)
  })
})
