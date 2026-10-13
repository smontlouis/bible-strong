import React, { useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import { PushRouteGateContext } from '../pushRouteGate'
import { usePushRouteOnce } from '../usePushRouteOnce'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../pageTransition', () => ({
  navigateWithPageTransition: (_pathname: string, navigate: () => void) => navigate(),
}))
jest.mock('../currentRouteInfo', () => ({
  getCurrentRouteInfo: () => ({ pathname: '/', params: {} }),
}))
jest.mock('../publicRouteNormalization', () => ({
  normalizePublicRoute: (route: unknown) => route,
}))
jest.mock('~state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: () => 'LSG' }))
jest.mock('~state/resourcesLanguage', () => ({
  useResourcesLanguageValue: () => ({ TIMELINE: 'fr' }),
}))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))

type Push = ReturnType<typeof usePushRouteOnce>
let push!: Push
function Reader({ onReady }: { onReady: (push: Push) => void }) {
  const pushRoute = usePushRouteOnce()
  useEffect(() => onReady(pushRoute))
  return null
}
const ready = (value: Push) => {
  push = value
}

describe('pushing a route from a surface presented above the navigator', () => {
  beforeEach(() => mockPush.mockClear())

  it('pushes immediately when nothing stands in the way', async () => {
    await act(async () => {
      create(<Reader onReady={ready} />)
    })
    push({ pathname: '/bible-view', params: { book: '43' } })
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/bible-view', params: { book: '43' } })
  })

  it('waits for the surface to step aside before pushing', async () => {
    let release: (() => void) | undefined
    await act(async () => {
      create(
        <PushRouteGateContext.Provider
          value={navigate => {
            release = navigate
          }}
        >
          <Reader onReady={ready} />
        </PushRouteGateContext.Provider>
      )
    })
    push({ pathname: '/bible-view', params: { book: '43' } })
    expect(mockPush).not.toHaveBeenCalled()
    release?.()
    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})
