import { getTokenByWordIndex, tokenizeVerseText } from '~helpers/wordTokenizer'

export interface AnnotationTextNodeInfo {
  node: Text
  startOffset: number
  endOffset: number
}

export const collectAnnotationTextNodes = (
  element: Element
): {
  fullText: string
  textNodes: AnnotationTextNodeInfo[]
} => {
  const textNodes: AnnotationTextNodeInfo[] = []
  let currentOffset = 0
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node: Text | null

  while ((node = walker.nextNode() as Text | null)) {
    if (!node.parentElement || !document.contains(node)) continue
    if (node.parentElement.closest('[data-ignore-verse-touch]')) continue

    const length = node.textContent?.length ?? 0
    if (length === 0) continue
    textNodes.push({
      node,
      startOffset: currentOffset,
      endOffset: currentOffset + length,
    })
    currentOffset += length
  }

  return {
    fullText: textNodes.map(item => item.node.textContent).join(''),
    textNodes,
  }
}

export const getAnnotationInsertionPoint = (
  verseElement: Element,
  endWordIndex: number
): { node: Text; offset: number } | undefined => {
  const { fullText, textNodes } = collectAnnotationTextNodes(verseElement)
  if (!fullText || !textNodes.length) return undefined

  const endToken = getTokenByWordIndex(tokenizeVerseText(fullText), endWordIndex)
  if (!endToken) return undefined

  const textNode = textNodes.find(
    item => endToken.charEnd >= item.startOffset && endToken.charEnd <= item.endOffset
  )
  if (!textNode) return undefined

  return {
    node: textNode.node,
    offset: endToken.charEnd - textNode.startOffset,
  }
}

export const createAnnotationTextRanges = (
  textNodes: AnnotationTextNodeInfo[],
  startCharIndex: number,
  endCharIndex: number
): Range[] =>
  textNodes.flatMap(info => {
    const start = Math.max(startCharIndex, info.startOffset)
    const end = Math.min(endCharIndex, info.endOffset)
    if (end <= start) return []

    const range = document.createRange()
    range.setStart(info.node, start - info.startOffset)
    range.setEnd(info.node, end - info.startOffset)
    return [range]
  })

export const clampAnnotationWordRange = (
  startWordIndex: number,
  endWordIndex: number,
  wordCount: number
): { start: number; end: number } | undefined => {
  if (wordCount <= 0) return undefined
  const lastWordIndex = wordCount - 1
  const clamp = (value: number) =>
    Math.max(0, Math.min(Number.isFinite(value) ? value : 0, lastWordIndex))
  const start = clamp(startWordIndex)
  const end = clamp(endWordIndex)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}
