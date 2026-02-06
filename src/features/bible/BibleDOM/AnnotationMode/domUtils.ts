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
export function getCaretInfoFromPoint(clientX: number, clientY: number): CaretInfo | null {
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
          charOffset: toGlobalCharOffset(range.startContainer as Text, range.startOffset),
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
          charOffset: toGlobalCharOffset(textNode, charOffset),
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
      charOffset: toGlobalCharOffset(textNodes[0], 0),
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
 * Gets the bounding rect for a single character in a text node.
 * Reuses the provided Range to avoid allocation overhead in hot loops.
 */
function getCharRect(range: Range, textNode: Text, index: number): DOMRect {
  range.setStart(textNode, index)
  range.setEnd(textNode, index + 1)
  return range.getBoundingClientRect()
}

/**
 * Finds the character offset within a text node using a two-phase approach:
 * 1. Identify which line the touch point is on (by Y coordinate)
 * 2. Binary search within that line's character range for the correct X position
 *
 * This replaces the previous O(n) linear scan with O(n/lineLength + log(lineLength)),
 * which is significantly faster for long text nodes during touch interactions.
 */
function findCharOffsetInTextNode(textNode: Text, clientX: number, viewportY: number): number {
  const text = textNode.textContent || ''
  if (text.length === 0) return 0

  const range = document.createRange()
  const LINE_HEIGHT_TOLERANCE = 30

  // Phase 1: Find the line boundaries that contain the touch Y coordinate.
  // Sample characters at intervals to find a character on the correct line,
  // then expand outward to find the full line range.
  const SAMPLE_STEP = Math.max(1, Math.floor(text.length / 20))
  let anchorIndex = -1

  for (let i = 0; i < text.length; i += SAMPLE_STEP) {
    const rect = getCharRect(range, textNode, i)
    const charCenterY = rect.top + rect.height / 2
    if (Math.abs(charCenterY - viewportY) < LINE_HEIGHT_TOLERANCE) {
      anchorIndex = i
      break
    }
  }

  // If sampling missed, do a linear scan (rare, only for very short text)
  if (anchorIndex === -1) {
    for (let i = 0; i < text.length; i++) {
      const rect = getCharRect(range, textNode, i)
      const charCenterY = rect.top + rect.height / 2
      if (Math.abs(charCenterY - viewportY) < LINE_HEIGHT_TOLERANCE) {
        anchorIndex = i
        break
      }
    }
  }

  // No character on the correct line - fall back to closest character overall
  if (anchorIndex === -1) {
    return findClosestCharOverall(range, textNode, text, clientX, viewportY)
  }

  // Expand from anchor to find the full line range
  let lineStart = anchorIndex
  let lineEnd = anchorIndex

  while (lineStart > 0) {
    const rect = getCharRect(range, textNode, lineStart - 1)
    const charCenterY = rect.top + rect.height / 2
    if (Math.abs(charCenterY - viewportY) >= LINE_HEIGHT_TOLERANCE) break
    lineStart--
  }

  while (lineEnd < text.length - 1) {
    const rect = getCharRect(range, textNode, lineEnd + 1)
    const charCenterY = rect.top + rect.height / 2
    if (Math.abs(charCenterY - viewportY) >= LINE_HEIGHT_TOLERANCE) break
    lineEnd++
  }

  // Phase 2: Linear scan within the line for the correct X position.
  // We use a linear scan instead of binary search because RTL text (Hebrew)
  // has non-monotonic X positions, making binary search unreliable.
  // The line range is typically small (40-80 chars), so this is fast enough.
  let bestIndex = lineStart
  let bestDistance = Infinity

  for (let i = lineStart; i <= lineEnd; i++) {
    const rect = getCharRect(range, textNode, i)

    // Exact hit
    if (clientX >= rect.left && clientX <= rect.right) {
      return i
    }

    const xDistance = clientX < rect.left ? rect.left - clientX : clientX - rect.right
    if (xDistance < bestDistance) {
      bestDistance = xDistance
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Fallback: finds the closest character to a point by Euclidean distance.
 * Only used when no character is found on the correct line (rare edge case).
 */
function findClosestCharOverall(
  range: Range,
  textNode: Text,
  text: string,
  clientX: number,
  viewportY: number
): number {
  let closestIndex = 0
  let closestDistance = Infinity

  for (let i = 0; i < text.length; i++) {
    const rect = getCharRect(range, textNode, i)
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
      charOffset: toGlobalCharOffset(closestNode, charOffset),
      targetElement: closestNode.parentElement,
    }
  }

  return null
}

/**
 * Converts a text-node-local character offset to a global offset
 * relative to the verse text element (the [id^="verse-text-"] ancestor).
 *
 * This is needed because inline elements (like red words spans or Strong's refs)
 * split the verse text into multiple DOM text nodes, but the word tokenizer
 * expects offsets relative to the full verse text string.
 *
 * When there is only a single text node (no inline spans), this is a no-op.
 */
function toGlobalCharOffset(textNode: Text, localOffset: number): number {
  let verseTextEl: Element | null = textNode.parentElement
  while (verseTextEl && !(verseTextEl.id && verseTextEl.id.startsWith('verse-text-'))) {
    verseTextEl = verseTextEl.parentElement
  }

  if (!verseTextEl) return localOffset

  const walker = document.createTreeWalker(verseTextEl, NodeFilter.SHOW_TEXT)
  let offset = 0
  let node: Text | null

  while ((node = walker.nextNode() as Text | null)) {
    if (node === textNode) {
      return offset + localOffset
    }
    offset += node.textContent?.length || 0
  }

  return localOffset
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
