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
  it('handles Option alternate characters on Mac', () => {
    expect(
      workspaceShortcut(key({ key: '˜', code: 'KeyN', metaKey: true, altKey: true }), true)
    ).toBe('new')
    expect(
      workspaceShortcut(key({ key: '∑', code: 'KeyW', metaKey: true, altKey: true }), true)
    ).toBe('close')
  })
  it('respects AZERTY letters, including Option-transformed W', () => {
    expect(workspaceShortcut(key({ key: 'q', code: 'KeyA', ctrlKey: true }), true)).toBe('switcher')
    expect(
      workspaceShortcut(
        key({ key: '‹', code: 'KeyZ', keyCode: 87, metaKey: true, altKey: true }),
        true
      )
    ).toBe('close')
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
      workspaceShortcut(
        key({ code: 'KeyN', altKey: true, ctrlKey: true, isComposing: true }),
        false
      )
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
      'switcher'
    )
    expect(workspaceShortcut(key({ code: 'KeyQ', altKey: true, shiftKey: true }), false)).toBe(
      'switcher'
    )
    expect(workspaceShortcut(key({ code: 'KeyQ', metaKey: true }), true)).toBeUndefined()
  })
  it('wraps in both directions and handles an empty group', () => {
    expect(cycleIndex(0, -1, 3)).toBe(2)
    expect(cycleIndex(2, 1, 3)).toBe(0)
    expect(cycleIndex(0, 1, 0)).toBe(-1)
  })
})
