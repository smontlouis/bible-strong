import { hasModalBackgroundRoute } from '../modalRoutePresentation'

describe('Web modal route presentation', () => {
  it('uses a full page when a route is loaded directly', () => {
    expect(hasModalBackgroundRoute({ index: 0, routes: [{}] })).toBe(false)
  })

  it('uses an overlay when client navigation preserved a background route', () => {
    expect(hasModalBackgroundRoute({ index: 1, routes: [{}, {}] })).toBe(true)
  })

  it('reads the application stack nested below the Expo Router root shell', () => {
    expect(
      hasModalBackgroundRoute({
        index: 0,
        routes: [{ state: { index: 1, routes: [{}, {}] } }],
      })
    ).toBe(true)
  })

  it('does not treat navigation inside a directly loaded modal group as a background route', () => {
    expect(
      hasModalBackgroundRoute({
        index: 0,
        routes: [
          {
            state: {
              index: 0,
              routes: [{ state: { index: 1, routes: [{}, {}] } }],
            },
          },
        ],
      })
    ).toBe(false)
  })
})
