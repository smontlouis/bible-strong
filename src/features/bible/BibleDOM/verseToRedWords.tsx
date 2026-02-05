import { styled } from 'goober'
import { tokenizeVerseText } from '~helpers/wordTokenizer'

type RedWordsRange = { start: number; end: number }

const RedSpan = styled('span')<{ redColor: string }>(({ redColor }) => ({
  color: redColor,
}))

export function verseToRedWords(
  text: string,
  ranges: RedWordsRange[],
  redColor: string
): (string | JSX.Element)[] {
  const tokens = tokenizeVerseText(text)
  // Build set of word indices that are red
  const redIndices = new Set<number>()
  for (const { start, end } of ranges) {
    for (let i = start; i <= end; i++) redIndices.add(i)
  }
  // Group consecutive tokens into red/normal segments
  const segments: { text: string; isRed: boolean }[] = []
  let current = { text: '', isRed: false }
  for (const token of tokens) {
    const isRed = !token.isWhitespace && redIndices.has(token.index)
    // Whitespace inherits the color of the surrounding context
    const effectiveRed = token.isWhitespace ? current.isRed : isRed
    if (segments.length === 0 && current.text === '') {
      current = { text: token.word, isRed: effectiveRed }
    } else if (effectiveRed === current.isRed) {
      current.text += token.word
    } else {
      segments.push(current)
      current = { text: token.word, isRed: effectiveRed }
    }
  }
  if (current.text) segments.push(current)
  // Convert to JSX
  return segments.map((seg, i) =>
    seg.isRed ? (
      <RedSpan key={i} redColor={redColor}>
        {seg.text}
      </RedSpan>
    ) : (
      seg.text
    )
  )
}
