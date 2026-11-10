import { salesChannel } from '../salesChannel.desktop'

let mockBootstrap: { distribution?: string; updater: boolean } = {
  distribution: 'direct',
  updater: true,
}

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))

jest.mock('~desktop/bridge', () => ({ desktopBootstrap: () => mockBootstrap }))

describe('the sales channel of the desktop app', () => {
  it('sells through the web checkout in the installer builds', () => {
    mockBootstrap = { distribution: 'direct', updater: true }
    expect(salesChannel()).toBe('web_link')
  })

  it('sells nothing in the Mac App Store build', () => {
    mockBootstrap = { distribution: 'mac_app_store', updater: false }
    expect(salesChannel()).toBe('none')
  })

  it('sells nothing in a shell that states no distribution, or that carries no updater', () => {
    mockBootstrap = { updater: true }
    expect(salesChannel()).toBe('none')
    mockBootstrap = { distribution: 'direct', updater: false }
    expect(salesChannel()).toBe('none')
  })
})
