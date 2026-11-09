jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn() }))
jest.mock('@tauri-apps/plugin-opener', () => ({ openUrl: jest.fn() }))
jest.mock('../bridge', () => ({ invoke: jest.fn(), desktopBootstrap: jest.fn() }))
jest.mock('../desktopUpdates', () => ({ checkDesktopUpdate: jest.fn() }))
jest.mock('../useDesktopAppearance', () => ({ useDesktopAppearance: jest.fn() }))
jest.mock('../useDesktopWindowTitle', () => ({ useDesktopWindowTitle: jest.fn() }))
jest.mock('../windowControls', () => ({ useDesktopFullscreen: jest.fn() }))
jest.mock('../textSize', () => ({ useTextSizeChange: jest.fn() }))
jest.mock('~features/print/markForPrint', () => ({ markForPrint: jest.fn() }))
jest.mock('~helpers/storage.desktop', () => ({ flushStorage: jest.fn() }))
jest.mock('~helpers/agentObservability', () => ({ appLogger: {} }))
jest.mock('expo-router', () => ({ useRouter: jest.fn() }))

import { desktopLinkRoute } from '../DesktopShell'

describe('links handed over to the desktop app', () => {
  it('opens the app scheme on its route', () => {
    expect(desktopLinkRoute('biblestrong://bible/LSG/JHN/3/16')).toBe('/bible/LSG/JHN/3/16')
    expect(desktopLinkRoute('biblestrong:///strong/G26')).toBe('/strong/G26')
  })

  it('opens a page of the public site where the workspace shows it', () => {
    expect(desktopLinkRoute('https://bible-strong.app/strong/fr/g26')).toBe('/strong/g26')
  })

  it('ignores links that lead nowhere in the workspace', () => {
    expect(desktopLinkRoute('https://example.com/page')).toBeUndefined()
  })
})
