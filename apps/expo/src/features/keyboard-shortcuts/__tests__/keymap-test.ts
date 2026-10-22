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
