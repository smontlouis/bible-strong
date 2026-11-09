jest.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: jest.fn() }))
jest.mock('~helpers/agentObservability', () => ({ appLogger: { warn: jest.fn() } }))
jest.mock('~state/tabs', () => {
  const { atom } = jest.requireActual('jotai')
  return { activeTabIndexAtom: atom(0), tabsAtom: atom([]) }
})

import { desktopWindowTitle } from '../useDesktopWindowTitle'

describe('the window title', () => {
  it('names the active tab before the app', () => {
    expect(desktopWindowTitle('Jean 3')).toBe('Jean 3 — Bible Strong')
    expect(desktopWindowTitle('  Genèse 1 ')).toBe('Genèse 1 — Bible Strong')
  })

  it('is the app alone without a titled tab', () => {
    expect(desktopWindowTitle(undefined)).toBe('Bible Strong')
    expect(desktopWindowTitle('')).toBe('Bible Strong')
    expect(desktopWindowTitle('   ')).toBe('Bible Strong')
  })
})
