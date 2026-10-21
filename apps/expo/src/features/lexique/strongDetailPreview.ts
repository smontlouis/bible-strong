const normalizeText = (value: string): string => value.replace(/\s+/gu, '')

export const isStrongEditorialPreviewOverflowing = (
  fullText: string,
  renderedLines: string[],
  maximumLines: number
): boolean => {
  if (renderedLines.length > maximumLines) return true

  const normalizedFullText = normalizeText(fullText)
  const normalizedRenderedText = normalizeText(renderedLines.join(' '))
  if (normalizedRenderedText === normalizedFullText) return false

  return normalizedRenderedText.replace(/(?:…|\.{3})$/u, '').length < normalizedFullText.length
}

export const hasHiddenStrongPreviewItems = (total: number, displayed: number): boolean =>
  total > displayed

const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu

const cutAfterWord = (html: string, index: number): string => {
  const space = html.slice(index).search(/\s/u)
  return space === -1 ? html : html.slice(0, index + space)
}

/**
 * The start of an editorial text holding at least `textLength` characters of text, cut after a
 * word. A preview shows a few lines: preparing the whole entry (finding its Bible references)
 * cost about 0.4 s in development for a 23 KB dictionary article.
 */
export const getStrongEditorialPreviewHtml = (html: string, textLength: number): string => {
  let cursor = 0
  let length = 0
  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const text = html.slice(cursor, match.index)
    if (length + text.length >= textLength) return cutAfterWord(html, cursor + textLength - length)
    length += text.length
    cursor = match.index + match[0].length
  }
  return length + html.length - cursor > textLength
    ? cutAfterWord(html, cursor + textLength - length)
    : html
}
