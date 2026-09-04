import { shouldUseSharedBibleDOM } from '../sharedBibleDOMPlatform'

describe('shared Bible DOM platform boundary', () => {
  it('keeps the shared WebView optimization on Android tabs', () => {
    expect(shouldUseSharedBibleDOM('android', true)).toBe(true)
  })

  it.each(['web', 'ios'])('renders one inline DOM tree per tab on %s', platform => {
    expect(shouldUseSharedBibleDOM(platform, true)).toBe(false)
  })

  it('does not share a DOM outside the tab runtime', () => {
    expect(shouldUseSharedBibleDOM('android', false)).toBe(false)
  })
})
