'use dom'

export interface CaretInfo {
  charOffset: number
  targetElement: Element | null
}

/**
 * Gets caret information (character offset and target element) from screen coordinates.
 *
 * Uses a hybrid approach inspired by ProseMirror's solution for iOS WebKit bugs:
 * 1. Use elementFromPoint first (reliable on iOS)
 * 2. Try caretRangeFromPoint but VALIDATE its result is near the touch point
 * 3. Fall back to manual word finding by examining element bounds
 *
 * This works around the known iOS WebView bug where caretRangeFromPoint returns
 * incorrect results when the page is scrolled.
 *
 * @param clientX - X coordinate in screen/client space
 * @param clientY - Y coordinate in screen/client space
 */
export function getCaretInfoFromPoint(
  clientX: number,
  clientY: number
): CaretInfo | null {
  const viewportY = clientY
  const elements = document.elementsFromPoint(clientX, viewportY)

  // Find verse container in elements
  let verseContainer: Element | null = null
  let targetElement: Element | null = null

  for (const el of elements) {
    const container = findVerseContainer(el)
    if (container) {
      targetElement = el
      verseContainer = container
      break
    }
  }

  if (!verseContainer) {
    return null
  }

  // Try caretRangeFromPoint but VALIDATE its result
  // @ts-ignore - caretRangeFromPoint is not in TypeScript's DOM types
  if (document.caretRangeFromPoint) {
    // @ts-ignore
    const range = document.caretRangeFromPoint(clientX, viewportY)
    if (range && range.startContainer) {
      const rangeRect = range.getBoundingClientRect()
      const yDistance = Math.abs(rangeRect.top - viewportY)

      // Only trust result if it's near where we touched (within 50px)
      if (yDistance < 50) {
        return {
          charOffset: range.startOffset,
          targetElement: range.startContainer.parentElement,
        }
      }
    }
  }

  // Fallback - find word by examining element bounds
  return findWordInElementByPosition(targetElement!, clientX, viewportY)
}

/**
 * Finds the word position within an element by examining text node bounds.
 * This is the fallback when caretRangeFromPoint fails (common on iOS when scrolled).
 */
function findWordInElementByPosition(
  element: Element,
  clientX: number,
  viewportY: number
): CaretInfo | null {
  const textNodes = getTextNodesIn(element)

  for (const textNode of textNodes) {
    const range = document.createRange()
    range.selectNodeContents(textNode)
    const rects = range.getClientRects()

    for (const rect of Array.from(rects)) {
      if (isPointInRect(clientX, viewportY, rect)) {
        const charOffset = findCharOffsetInTextNode(textNode, clientX, viewportY)
        return {
          charOffset,
          targetElement: textNode.parentElement,
        }
      }
    }
  }

  // If no exact match, find the closest text node vertically
  const closestResult = findClosestTextNode(textNodes, clientX, viewportY)
  if (closestResult) {
    return closestResult
  }

  // Ultimate fallback: return first text node with offset 0
  if (textNodes.length > 0) {
    return {
      charOffset: 0,
      targetElement: textNodes[0].parentElement,
    }
  }

  return null
}

/**
 * Gets all text nodes within an element.
 */
function getTextNodesIn(element: Element): Text[] {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    // Skip empty or whitespace-only text nodes
    if (node.textContent && node.textContent.trim().length > 0) {
      textNodes.push(node)
    }
  }

  return textNodes
}

/**
 * Checks if a point is inside a DOMRect.
 */
function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/**
 * Finds the character offset within a text node by scanning characters on the correct line.
 * For multi-line text, we first filter to characters on the same line (by Y coordinate),
 * then find the character at the correct X position.
 */
function findCharOffsetInTextNode(textNode: Text, clientX: number, viewportY: number): number {
  const text = textNode.textContent || ''
  if (text.length === 0) return 0

  const range = document.createRange()

  // First, find all characters that are on the same line as our touch point
  // (within a reasonable Y tolerance for the line height)
  const LINE_HEIGHT_TOLERANCE = 30 // pixels

  let bestMatch: { index: number; xDistance: number } | null = null

  for (let i = 0; i < text.length; i++) {
    range.setStart(textNode, i)
    range.setEnd(textNode, i + 1)
    const rect = range.getBoundingClientRect()

    // Check if this character is on the same line (Y coordinate matches)
    const charCenterY = rect.top + rect.height / 2
    const yDistance = Math.abs(charCenterY - viewportY)

    if (yDistance < LINE_HEIGHT_TOLERANCE) {
      // This character is on the correct line
      // Check if X coordinate matches
      if (clientX >= rect.left && clientX <= rect.right) {
        // Exact match!
        return i
      }

      // Track closest X match on this line
      const xDistance = clientX < rect.left ? rect.left - clientX : clientX - rect.right
      if (!bestMatch || xDistance < bestMatch.xDistance) {
        bestMatch = { index: i, xDistance }
      }
    }
  }

  // Return best match on the correct line, or fallback to 0
  if (bestMatch) {
    return bestMatch.index
  }

  // Fallback: linear scan for closest character overall
  let closestIndex = 0
  let closestDistance = Infinity

  for (let i = 0; i < text.length; i++) {
    range.setStart(textNode, i)
    range.setEnd(textNode, i + 1)
    const rect = range.getBoundingClientRect()

    const charCenterX = rect.left + rect.width / 2
    const charCenterY = rect.top + rect.height / 2
    const distance = Math.sqrt(
      Math.pow(clientX - charCenterX, 2) + Math.pow(viewportY - charCenterY, 2)
    )

    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  return closestIndex
}

/**
 * Finds the closest text node to a point when no exact match exists.
 * Useful when the touch is slightly outside the text bounds.
 */
function findClosestTextNode(
  textNodes: Text[],
  clientX: number,
  viewportY: number
): CaretInfo | null {
  let closestNode: Text | null = null
  let closestDistance = Infinity

  for (const textNode of textNodes) {
    const range = document.createRange()
    range.selectNodeContents(textNode)
    const rects = range.getClientRects()

    for (const rect of Array.from(rects)) {
      // Calculate distance to rect center
      const rectCenterY = rect.top + rect.height / 2
      const yDistance = Math.abs(viewportY - rectCenterY)

      // Only consider nodes that are reasonably close vertically (within one line height)
      if (yDistance < rect.height * 1.5 && yDistance < closestDistance) {
        closestDistance = yDistance
        closestNode = textNode
      }
    }
  }

  if (closestNode) {
    const charOffset = findCharOffsetInTextNode(closestNode, clientX, viewportY)
    return {
      charOffset,
      targetElement: closestNode.parentElement,
    }
  }

  return null
}

/**
 * Walks up the DOM tree to find the verse container element (with data-verse-key attribute).
 */
export function findVerseContainer(element: Element | null): Element | null {
  let current: Element | null = element
  while (current && !current.hasAttribute('data-verse-key')) {
    current = current.parentElement
  }
  return current
}
