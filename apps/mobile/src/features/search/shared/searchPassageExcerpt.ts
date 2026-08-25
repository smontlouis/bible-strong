type HighlightRange = {
  start: number
  end: number
}

const parseHighlightedText = (highlighted: string) => {
  const ranges: HighlightRange[] = []
  let text = ''
  let sourceOffset = 0

  for (const match of highlighted.matchAll(/\{\{(.*?)\}\}/gu)) {
    const matchIndex = match.index ?? sourceOffset
    text += highlighted.slice(sourceOffset, matchIndex)
    const matchedText = match[1]
    const start = text.length
    text += matchedText
    ranges.push({ start, end: text.length })
    sourceOffset = matchIndex + match[0].length
  }

  text += highlighted.slice(sourceOffset)
  return { text, ranges }
}

const restoreHighlightMarkers = (text: string, ranges: readonly HighlightRange[]) =>
  [...ranges]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (highlighted, range) =>
        `${highlighted.slice(0, range.start)}{{${highlighted.slice(
          range.start,
          range.end
        )}}}${highlighted.slice(range.end)}`,
      text
    )

export const getPassageSearchExcerpt = (highlighted: string, maximumLength = 72) => {
  const { text, ranges } = parseHighlightedText(highlighted)
  if (!ranges.length || text.length <= maximumLength) return highlighted

  const firstRange = ranges[0]
  const lastRange = ranges.at(-1) ?? firstRange
  const allMatchesFit = lastRange.end - firstRange.start <= maximumLength
  const focusEnd = allMatchesFit ? lastRange.end : firstRange.end
  const focusCenter = Math.round((firstRange.start + focusEnd) / 2)
  let start = Math.max(0, focusCenter - maximumLength / 2)
  let end = Math.min(text.length, start + maximumLength)

  if (start > 0) {
    const nextSpace = text.indexOf(' ', start)
    if (nextSpace !== -1 && nextSpace < firstRange.start) start = nextSpace + 1
  }
  if (end < text.length) {
    const previousSpace = text.lastIndexOf(' ', end)
    if (previousSpace > focusEnd) end = previousSpace
  }

  const prefix = start > 0 ? '… ' : ''
  const suffix = end < text.length ? ' …' : ''
  const excerptRanges = ranges.flatMap(range => {
    const clippedStart = Math.max(range.start, start)
    const clippedEnd = Math.min(range.end, end)
    if (clippedStart >= clippedEnd) return []
    return [{ start: clippedStart - start, end: clippedEnd - start }]
  })

  return `${prefix}${restoreHighlightMarkers(text.slice(start, end), excerptRanges)}${suffix}`
}
