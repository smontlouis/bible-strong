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
