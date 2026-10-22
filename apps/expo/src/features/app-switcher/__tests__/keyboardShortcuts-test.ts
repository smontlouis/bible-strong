import { cycleIndex, workspaceShortcut } from '../keyboardShortcuts'
const key = (overrides: Partial<Parameters<typeof workspaceShortcut>[0]>) => ({
  key: '',
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  getModifierState: () => false,
  ...overrides,
})

describe('workspace keyboard shortcuts', () => {
  it('accepts synthetic input events without getModifierState', () => {
    const event = key({ key: 'a', code: 'KeyA', getModifierState: undefined })
    expect(workspaceShortcut(event, true)).toBeUndefined()
    expect(workspaceShortcut(event, false)).toBeUndefined()
    expect(workspaceShortcut({ ...event, key: 'b', metaKey: true }, true)).toBe('sidebar')
    expect(workspaceShortcut({ ...event, key: 't', altKey: true }, false)).toBe('newTab')
  })
  it('opens and closes tabs with Control on a Mac, Alt elsewhere', () => {
    expect(workspaceShortcut(key({ key: 't', code: 'KeyT', ctrlKey: true }), true)).toBe('newTab')
    expect(workspaceShortcut(key({ key: 'w', code: 'KeyW', ctrlKey: true }), true)).toBe('closeTab')
    expect(workspaceShortcut(key({ key: 't', code: 'KeyT', altKey: true }), false)).toBe('newTab')
    expect(workspaceShortcut(key({ key: 'w', code: 'KeyW', altKey: true }), false)).toBe('closeTab')
  })
  it('leaves the old Cmd Option combinations to the browser', () => {
    expect(
      workspaceShortcut(key({ key: '˜', code: 'KeyN', metaKey: true, altKey: true }), true)
    ).toBeUndefined()
    expect(
      workspaceShortcut(key({ key: '∑', code: 'KeyW', metaKey: true, altKey: true }), true)
    ).toBeUndefined()
  })
  it('respects AZERTY letters', () => {
    expect(workspaceShortcut(key({ key: 'q', code: 'KeyA', ctrlKey: true }), true)).toBe(
      'recentTabs'
    )
    expect(workspaceShortcut(key({ key: 'w', code: 'KeyZ', ctrlKey: true }), true)).toBe('closeTab')
  })
  it('does not intercept browser tabs or OS app switching', () => {
    for (const mac of [true, false]) {
      for (const letter of ['T', 'W', 'N'])
        expect(
          workspaceShortcut(key({ code: `Key${letter}`, metaKey: mac, ctrlKey: !mac }), mac)
        ).toBeUndefined()
      expect(workspaceShortcut(key({ key: 'Tab', ctrlKey: true }), mac)).toBeUndefined()
      expect(workspaceShortcut(key({ key: 'Tab', altKey: true }), mac)).toBeUndefined()
    }
  })
  it('ignores composition and AltGr character input', () => {
    expect(
      workspaceShortcut(key({ code: 'KeyT', altKey: true, isComposing: true }), false)
    ).toBeUndefined()
    expect(
      workspaceShortcut(
        key({
          code: 'KeyW',
          altKey: true,
          ctrlKey: true,
          getModifierState: name => name === 'AltGraph',
        }),
        false
      )
    ).toBeUndefined()
  })
  it('supports reverse recent switching without catching Cmd Q', () => {
    expect(workspaceShortcut(key({ code: 'KeyQ', ctrlKey: true, shiftKey: true }), true)).toBe(
      'recentTabs'
    )
    expect(workspaceShortcut(key({ code: 'KeyQ', altKey: true, shiftKey: true }), false)).toBe(
      'recentTabs'
    )
    expect(workspaceShortcut(key({ code: 'KeyQ', metaKey: true }), true)).toBeUndefined()
  })
  it('moves between tabs with Option and opens the guide with ?', () => {
    expect(workspaceShortcut(key({ key: 'ArrowUp', altKey: true }), true)).toBe('previousTab')
    expect(workspaceShortcut(key({ key: 'ArrowDown', altKey: true }), false)).toBe('nextTab')
    expect(workspaceShortcut(key({ key: '?', code: 'Comma', shiftKey: true }), true)).toBe('guide')
  })
  it('wraps in both directions and handles an empty group', () => {
    expect(cycleIndex(0, -1, 3)).toBe(2)
    expect(cycleIndex(2, 1, 3)).toBe(0)
    expect(cycleIndex(0, 1, 0)).toBe(-1)
  })
})
