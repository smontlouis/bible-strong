import { styled } from 'goober'

type RedWordsRange = { start: number; end: number }

const RedSpan = styled('span')<{ redColor: string }>(({ redColor }) => ({
  color: redColor,
}))

const WORD_REGEX = /\S+/g

export function verseToRedWords(
  text: string,
  ranges: RedWordsRange[],
  redColor: string
): (string | JSX.Element)[] {
  // Find character boundaries of each word via regex
  const wordBounds: [number, number][] = []
  let m: RegExpExecArray | null
  while ((m = WORD_REGEX.exec(text))) {
    wordBounds.push([m.index, m.index + m[0].length])
  }
  WORD_REGEX.lastIndex = 0

  if (wordBounds.length === 0) return [text]

  // Convert word-index ranges to character ranges
  const charRanges: [number, number][] = []
  for (const { start, end } of ranges) {
    if (start >= wordBounds.length) continue
    const cEnd = Math.min(end, wordBounds.length - 1)
    charRanges.push([wordBounds[start][0], wordBounds[cEnd][1]])
  }

  // Sort & merge overlapping/adjacent ranges
  charRanges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of charRanges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1])
    } else {
      merged.push([r[0], r[1]])
    }
  }

  // Slice text into alternating normal/red segments
  const result: (string | JSX.Element)[] = []
  let pos = 0
  for (let i = 0; i < merged.length; i++) {
    const [s, e] = merged[i]
    if (pos < s) result.push(text.slice(pos, s))
    result.push(
      <RedSpan key={i} redColor={redColor}>
        {text.slice(s, e)}
      </RedSpan>
    )
    pos = e
  }
  if (pos < text.length) result.push(text.slice(pos))

  return result
}
