import type { BibleAudioPassage } from '../types'
import { createListenCounter } from '../listenStats'

jest.mock('~helpers/analytics', () => ({ trackAnalyticsEvent: jest.fn() }))
jest.mock('../audioCatalog', () => ({ SPEECH_CHOICE: 'speech' }))

const passage = (chapter: number) =>
  ({ version: 'LSG', book: { Numero: 1 }, chapter }) as unknown as BibleAudioPassage

describe('createListenCounter', () => {
  it('counts a chapter once when it starts, not when it resumes', () => {
    const track = jest.fn()
    const count = createListenCounter(track)
    count(passage(1), 'lsg-tresorsonore')
    count(passage(1), 'lsg-tresorsonore')
    count(passage(2), 'lsg-tresorsonore')
    expect(track.mock.calls).toEqual([
      [{ recording: 'lsg-tresorsonore', version: 'LSG', book: 1, chapter: 1 }],
      [{ recording: 'lsg-tresorsonore', version: 'LSG', book: 1, chapter: 2 }],
    ])
  })

  it('counts the same chapter again when heard with another recording or the device voice', () => {
    const track = jest.fn()
    const count = createListenCounter(track)
    count(passage(1), 'lsg-tresorsonore')
    count(passage(1), null)
    expect(track.mock.calls.map(([parameters]) => parameters.recording)).toEqual([
      'lsg-tresorsonore',
      'speech',
    ])
  })
})
