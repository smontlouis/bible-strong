import { SHORTCUT_SECTIONS, digitOf, findShortcut, formatShortcut, matchShortcut } from '../keymap'

const key = (overrides: Partial<Parameters<typeof matchShortcut>[0]>) => ({
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

describe('keymap', () => {
  it('tells a letter from its Shift and Command variants', () => {
    const c = key({ key: 'c', code: 'KeyC' })
    expect(findShortcut(c, ['copy', 'commentary', 'compare'], true)).toBe('compare')
    expect(
      findShortcut({ ...c, key: 'C', shiftKey: true }, ['copy', 'commentary', 'compare'], true)
    ).toBe('commentary')
    expect(findShortcut({ ...c, metaKey: true }, ['copy', 'commentary', 'compare'], true)).toBe(
      'copy'
    )
    expect(findShortcut({ ...c, ctrlKey: true }, ['copy', 'commentary', 'compare'], false)).toBe(
      'copy'
    )
    expect(matchShortcut({ ...c, ctrlKey: true }, 'copy', true)).toBe(false)
  })
  it('reads digits from the key position, so AZERTY works with or without Shift', () => {
    expect(matchShortcut(key({ key: '&', code: 'Digit1' }), 'highlight', true)).toBe(true)
    expect(
      matchShortcut(key({ key: '1', code: 'Digit1', shiftKey: true }), 'highlight', true)
    ).toBe(true)
    expect(matchShortcut(key({ key: '3', code: 'Numpad3' }), 'highlight', false)).toBe(true)
    expect(matchShortcut(key({ key: 'à', code: 'Digit0' }), 'highlight', true)).toBe(false)
    expect(matchShortcut(key({ key: 'à', code: 'Digit0' }), 'removeHighlight', true)).toBe(true)
    expect(digitOf({ code: 'Digit7' })).toBe(7)
    expect(digitOf({ code: 'KeyA' })).toBeUndefined()
  })
  it('matches letters on the reader’s layout, not the physical key', () => {
    expect(matchShortcut(key({ key: 'a', code: 'KeyQ' }), 'addToStudy', true)).toBe(true)
    expect(matchShortcut(key({ key: 'q', code: 'KeyA' }), 'addToStudy', true)).toBe(false)
  })
  it('ignores composition and AltGr', () => {
    expect(matchShortcut(key({ key: 'n', code: 'KeyN', isComposing: true }), 'note', true)).toBe(
      false
    )
    expect(
      matchShortcut(
        key({ key: 'n', code: 'KeyN', getModifierState: name => name === 'AltGraph' }),
        'note',
        false
      )
    ).toBe(false)
  })
  it('prints shortcuts in each platform’s convention', () => {
    expect(formatShortcut('tabActions', true)).toBe('⇧⌘K')
    expect(formatShortcut('tabActions', false)).toBe('Ctrl+⇧K')
    expect(formatShortcut('newTab', true)).toBe('⌃T')
    expect(formatShortcut('newTab', false)).toBe('Alt+T')
    expect(formatShortcut('relation', true)).toBe('⇧R')
    expect(formatShortcut('recentTabs', true)).toBe('⌃Q')
    expect(formatShortcut('highlight', true)).toBe('1–9')
    expect(formatShortcut('guide', true)).toBe('?')
  })
  it('lists every shortcut of the selection menu in the guide', () => {
    const listed = new Set(
      SHORTCUT_SECTIONS.flatMap(section => section.rows).flatMap(row => row.shortcuts)
    )
    for (const id of ['note', 'lexicon', 'topics', 'commentary', 'relation', 'selectAll'] as const)
      expect(listed.has(id)).toBe(true)
  })
})

describe('the desktop keymap', () => {
  const desktopKeymap = (): typeof import('../keymap') => {
    const previous = process.env.EXPO_PUBLIC_DESKTOP
    process.env.EXPO_PUBLIC_DESKTOP = '1'
    let keymap: typeof import('../keymap') | undefined
    jest.isolateModules(() => {
      keymap = require('../keymap')
    })
    process.env.EXPO_PUBLIC_DESKTOP = previous
    return keymap!
  }

  it('drives the tabs with the command key, as the system does', () => {
    const desktop = desktopKeymap()
    const t = key({ key: 't', code: 'KeyT' })
    expect(desktop.matchShortcut({ ...t, metaKey: true }, 'newTab', true)).toBe(true)
    expect(desktop.matchShortcut({ ...t, ctrlKey: true }, 'newTab', true)).toBe(false)
    expect(desktop.matchShortcut({ ...t, ctrlKey: true }, 'newTab', false)).toBe(true)
    expect(desktop.formatShortcut('closeTab', true)).toBe('⌘W')
    expect(desktop.formatShortcut('closeTab', false)).toBe('Ctrl+W')
    // ⌘Q quits: the recent tabs keep ⌃Q.
    expect(desktop.formatShortcut('recentTabs', true)).toBe('⌃Q')
  })

  it('moves between tabs with Control-Tab on every system, and keeps ⌥↑ and ⌥↓', () => {
    const desktop = desktopKeymap()
    const tab = key({ key: 'Tab', code: 'Tab', ctrlKey: true })
    expect(desktop.matchShortcut(tab, 'nextTab', true)).toBe(true)
    expect(desktop.matchShortcut(tab, 'nextTab', false)).toBe(true)
    expect(desktop.matchShortcut({ ...tab, shiftKey: true }, 'previousTab', true)).toBe(true)
    expect(desktop.matchShortcut({ ...tab, shiftKey: true }, 'nextTab', true)).toBe(false)
    expect(desktop.matchShortcut(key({ key: 'ArrowDown', altKey: true }), 'nextTab', true)).toBe(
      true
    )
  })

  it('reaches a tab by its place and opens the search', () => {
    const desktop = desktopKeymap()
    expect(
      desktop.matchShortcut(key({ key: '&', code: 'Digit1', metaKey: true }), 'goToTab', true)
    ).toBe(true)
    expect(
      desktop.matchShortcut(key({ key: '&', code: 'Digit1', metaKey: true }), 'highlight', true)
    ).toBe(false)
    expect(desktop.formatShortcut('find', true)).toBe('⌘F')
    const rows = desktop.SHORTCUT_SECTIONS.flatMap(section =>
      section.rows.flatMap(row => row.shortcuts)
    )
    expect(rows).toEqual(expect.arrayContaining(['goToTab', 'find']))
  })
})

describe('the Web keymap', () => {
  it('leaves ⌘T, ⌘W, ⌘1–9 and ⌘F to the browser', () => {
    expect(formatShortcut('newTab', true)).toBe('⌃T')
    expect(formatShortcut('closeTab', false)).toBe('Alt+W')
    const rows = SHORTCUT_SECTIONS.flatMap(section => section.rows.flatMap(row => row.shortcuts))
    expect(rows).not.toContain('goToTab')
    expect(rows).not.toContain('find')
  })
})
