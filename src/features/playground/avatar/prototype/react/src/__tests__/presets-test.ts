import { getStatePlaybackConfig } from '../presets'

describe('state playback configuration', () => {
  it('keeps idle slower than an active sequence', () => {
    expect(getStatePlaybackConfig('idle').expressionIntervalMs).toBe(5200)
    expect(getStatePlaybackConfig('listening').expressionIntervalMs).toBe(2300)
  })

  it('describes a valid randomized blink interval', () => {
    const { blink } = getStatePlaybackConfig('idle')

    expect(blink.initialDelayMs).toBeGreaterThan(0)
    expect(blink.minIntervalMs).toBeLessThan(blink.maxIntervalMs)
    expect(blink.durationMs).toBe(280)
  })

  it('uses a blink rhythm adapted to each sequence family', () => {
    const sleeping = getStatePlaybackConfig('sleeping').blink
    const listening = getStatePlaybackConfig('listening').blink
    const excited = getStatePlaybackConfig('excited').blink

    expect(sleeping.minIntervalMs).toBeGreaterThan(listening.minIntervalMs)
    expect(listening.minIntervalMs).toBeGreaterThan(excited.minIntervalMs)
    expect(sleeping.durationMs).toBeGreaterThan(excited.durationMs)
  })
})
