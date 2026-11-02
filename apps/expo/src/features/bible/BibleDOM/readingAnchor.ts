/** A place in a chapter that survives a change of text: a verse and how far into it the eye is. */
export type ReadingAnchor = {
  verse: number
  progress: number
}

type VerseElement = Pick<Element, 'id' | 'getBoundingClientRect'>

const getVerseNumber = (element: VerseElement) => Number(element.id.replace('verset-', ''))

/** The first verse still below the reading line, the top of what the reader sees. */
export const findReadingAnchor = (
  verses: VerseElement[],
  readingLine: number
): ReadingAnchor | null => {
  for (const element of verses) {
    const { top, bottom, height } = element.getBoundingClientRect()
    if (bottom <= readingLine) continue
    return {
      verse: getVerseNumber(element),
      progress: top < readingLine && height > 0 ? (readingLine - top) / height : 0,
    }
  }
  return null
}

/** How far to scroll to bring the anchor back to the line, or to the nearest verse before it. */
export const getReadingAnchorOffset = (
  verses: VerseElement[],
  anchor: ReadingAnchor,
  readingLine: number
) => {
  const target = verses.filter(element => getVerseNumber(element) <= anchor.verse).pop()
  if (!target) return null
  const { top, height } = target.getBoundingClientRect()
  return top + anchor.progress * height - readingLine
}
