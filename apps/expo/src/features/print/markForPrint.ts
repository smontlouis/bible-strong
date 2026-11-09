/**
 * Printing the workspace prints what the reader studies, whole: the content of the active tab or
 * page, not the sidebar, the headers or the buttons, and not only the part on screen.
 *
 * That content is the largest visible area that scrolls in the workspace: a Bible chapter, a
 * note, a study, a dictionary entry. Before printing, it is marked `data-print-root` and its
 * ancestors `data-print-path`; `print.css` then unfolds that chain to the content's full height
 * and hides everything beside it. The marks change nothing on screen, so they stay until the next
 * print marks again. Inside the content, `data-print-hide` keeps a part off paper and
 * `data-print-flush` drops the room a reading surface keeps for its header and footer.
 */

export const PRINT_ROOT = 'data-print-root'
export const PRINT_PATH = 'data-print-path'
/** On a dark theme, the page prints its text dark on white paper. */
export const PRINT_DARK = 'data-print-dark'

const WORKSPACE_SURFACE = '[data-testid="workspace-main-surface"]'

const area = (element: Element) => {
  const { width, height } = element.getBoundingClientRect()
  return width * height
}

const scrolls = (element: Element, view: Window) => {
  const { overflowY } = view.getComputedStyle(element)
  return overflowY === 'auto' || overflowY === 'scroll'
}

/** The content of the active tab or page: the largest visible area that scrolls. */
export const findPrintRoot = (doc: Document): Element | undefined => {
  const view = doc.defaultView
  if (!view) return undefined
  const surface = doc.querySelector(WORKSPACE_SURFACE) ?? doc.body
  let root: Element | undefined
  let rootArea = 0
  for (const element of surface.querySelectorAll('*')) {
    const elementArea = area(element)
    // Measured first: most elements are smaller than the best so far, and cheaper to skip.
    if (elementArea <= rootArea || !scrolls(element, view)) continue
    root = element
    rootArea = elementArea
  }
  return root
}

const channels = (color: string) =>
  color
    .match(/[\d.]+/g)
    ?.slice(0, 4)
    .map(Number)

/** The ground the content shows on: the first opaque background from it up. */
const isDarkGround = (element: Element, view: Window) => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const values = channels(view.getComputedStyle(node).backgroundColor)
    if (!values || values.length < 3 || values[3] === 0) continue
    const [red, green, blue] = values.map(value => value / 255)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 0.4
  }
  return false
}

/** Marks the active tab's content for printing; false when there is none to print alone. */
export const markForPrint = (doc: Document = document): boolean => {
  for (const marked of doc.querySelectorAll(`[${PRINT_ROOT}], [${PRINT_PATH}]`)) {
    marked.removeAttribute(PRINT_ROOT)
    marked.removeAttribute(PRINT_PATH)
  }
  doc.documentElement.removeAttribute(PRINT_DARK)
  const root = findPrintRoot(doc)
  const view = doc.defaultView
  if (!root || !view) return false
  root.setAttribute(PRINT_ROOT, '')
  for (let node = root.parentElement; node; node = node.parentElement) {
    node.setAttribute(PRINT_PATH, '')
  }
  if (isDarkGround(root, view)) doc.documentElement.setAttribute(PRINT_DARK, '')
  return true
}
