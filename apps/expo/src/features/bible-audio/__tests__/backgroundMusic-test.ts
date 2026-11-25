import type { BibleAudioState } from '../types'
import { getWantedMusicUrl } from '../backgroundMusic'

jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }))
jest.mock('../audioCatalog', () => ({}))
jest.mock('../atoms', () => ({}))

const PIANO = 'https://media.example.org/piano.mp3'
const state = (status: BibleAudioState['status']) =>
  ({
    passage: { version: 'LSG', chapter: 1 },
    source: 'recorded',
    recordingId: 'r',
    status,
  }) as BibleAudioState

describe('getWantedMusicUrl', () => {
  it('plays the music chosen while the passage plays', () => {
    expect(getWantedMusicUrl(state('playing'), PIANO, false, false)).toBe(PIANO)
    expect(getWantedMusicUrl(state('paused'), PIANO, true, false)).toBeUndefined()
    expect(getWantedMusicUrl(state('playing'), undefined, false, false)).toBeUndefined()
  })

  it('flows on while the next chapter loads, without starting on a load', () => {
    expect(getWantedMusicUrl(state('loading'), PIANO, true, false)).toBe(PIANO)
    expect(getWantedMusicUrl(state('loading'), PIANO, false, false)).toBeUndefined()
  })

  it('adds nothing to a chapter that already has music', () => {
    expect(getWantedMusicUrl(state('playing'), PIANO, true, true)).toBeUndefined()
  })
})
