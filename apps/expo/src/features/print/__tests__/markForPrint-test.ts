/**
 * @jest-environment jsdom
 */
import { PRINT_DARK, PRINT_PATH, PRINT_ROOT, findPrintRoot, markForPrint } from '../markForPrint'

const sized = (element: Element, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }) as DOMRect
}

const workspace = (ground = 'rgb(255, 255, 255)') => {
  document.documentElement.removeAttribute(PRINT_DARK)
  document.body.innerHTML = `
    <div id="root">
      <div id="sidebar" style="overflow-y: auto"></div>
      <div data-testid="workspace-main-surface" style="background-color: ${ground}">
        <div id="header"></div>
        <div id="reader">
          <div id="chapter" style="overflow-y: auto"><div id="text"></div></div>
          <div id="verses-menu" style="overflow-y: auto"></div>
        </div>
        <div id="hidden-tab" style="overflow-y: auto"></div>
      </div>
    </div>`
  const byId = (id: string) => document.getElementById(id)!
  sized(byId('sidebar'), 260, 840)
  sized(byId('chapter'), 900, 800)
  sized(byId('verses-menu'), 300, 200)
  sized(byId('hidden-tab'), 0, 0)
  return byId
}

describe('printing the active tab', () => {
  it('takes the largest visible area that scrolls in the workspace', () => {
    const byId = workspace()
    expect(findPrintRoot(document)).toBe(byId('chapter'))
  })

  it('marks the content and the chain up to the page, nothing beside them', () => {
    const byId = workspace()
    expect(markForPrint(document)).toBe(true)
    expect(byId('chapter').hasAttribute(PRINT_ROOT)).toBe(true)
    for (const id of ['reader', 'root']) expect(byId(id).hasAttribute(PRINT_PATH)).toBe(true)
    expect(document.body.hasAttribute(PRINT_PATH)).toBe(true)
    expect(document.documentElement.hasAttribute(PRINT_PATH)).toBe(true)
    for (const id of ['sidebar', 'header', 'verses-menu', 'text']) {
      expect(byId(id).hasAttribute(PRINT_PATH) || byId(id).hasAttribute(PRINT_ROOT)).toBe(false)
    }
    expect(document.documentElement.hasAttribute(PRINT_DARK)).toBe(false)
  })

  it('marks again from scratch at the next print', () => {
    const byId = workspace()
    markForPrint(document)
    sized(byId('chapter'), 0, 0)
    sized(byId('hidden-tab'), 900, 800)
    markForPrint(document)
    expect(byId('chapter').hasAttribute(PRINT_ROOT)).toBe(false)
    expect(byId('reader').hasAttribute(PRINT_PATH)).toBe(false)
    expect(byId('hidden-tab').hasAttribute(PRINT_ROOT)).toBe(true)
    expect(document.querySelectorAll(`[${PRINT_ROOT}]`)).toHaveLength(1)
  })

  it('prints a dark theme dark on white', () => {
    workspace('rgb(14, 21, 33)')
    markForPrint(document)
    expect(document.documentElement.hasAttribute(PRINT_DARK)).toBe(true)
  })

  it('leaves the page as it is without content to print alone', () => {
    const byId = workspace()
    for (const id of ['chapter', 'verses-menu', 'hidden-tab']) sized(byId(id), 0, 0)
    expect(markForPrint(document)).toBe(false)
    expect(document.querySelectorAll(`[${PRINT_ROOT}], [${PRINT_PATH}]`)).toHaveLength(0)
  })
})
