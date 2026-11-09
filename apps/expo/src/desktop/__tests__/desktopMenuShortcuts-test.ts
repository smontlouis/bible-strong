import { MENU_SHORTCUTS, isMenuShortcut, menuShortcutTarget } from '../desktopMenuShortcuts'

const field = { name: 'field' }
const body = { name: 'body' }
const doc = { activeElement: field, body } as unknown as Document

describe('the menu runs workspace shortcuts', () => {
  it('knows the Bible menu items', () => {
    for (const id of ['previousChapter', 'nextChapter', 'goToVerse', 'strongMode', 'compare']) {
      expect(isMenuShortcut(id)).toBe(true)
    }
    expect(isMenuShortcut('highlight')).toBe(false)
    expect(MENU_SHORTCUTS).toContain('newTab')
  })

  it('sends a chord with a modifier where the focus is', () => {
    expect(menuShortcutTarget('newTab', doc)).toBe(field)
    expect(menuShortcutTarget('palette', doc)).toBe(field)
  })

  it('sends a bare key to the page, so a focused field does not swallow it', () => {
    expect(menuShortcutTarget('nextChapter', doc)).toBe(body)
    expect(menuShortcutTarget('goToVerse', doc)).toBe(body)
    expect(menuShortcutTarget('compare', doc)).toBe(body)
  })

  it('falls back to the page when nothing has the focus', () => {
    const empty = { activeElement: null, body } as unknown as Document
    expect(menuShortcutTarget('sidebar', empty)).toBe(body)
  })
})
