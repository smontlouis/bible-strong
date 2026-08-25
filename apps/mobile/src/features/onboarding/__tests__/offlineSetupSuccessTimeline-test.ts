import { getOfflineSetupSuccessTimeline } from '../offlineSetupSuccessTimeline'

describe('offline setup success timeline', () => {
  it('keeps the welcome message visible for three seconds before fading out', () => {
    const timeline = getOfflineSetupSuccessTimeline(false)

    expect(timeline.welcomeStartsAt - timeline.readyEndsAt).toBe(320)
    expect(timeline.fadeOutStartsAt - timeline.welcomeStartsAt).toBe(3_000)
    expect(timeline.completesAt - timeline.fadeOutStartsAt).toBe(400)
  })

  it('keeps the welcome hold while removing transitions for reduced motion', () => {
    const timeline = getOfflineSetupSuccessTimeline(true)

    expect(timeline.fadeOutStartsAt - timeline.welcomeStartsAt).toBe(3_000)
    expect(timeline.completesAt).toBe(timeline.fadeOutStartsAt)
  })
})
