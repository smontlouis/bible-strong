import type { Verse as TVerse } from '~common/types'
import type { WordToken } from '~helpers/wordTokenizer'
import type { SelectionRange } from './AnnotationMode/selectionUtils'

const getVerseKey = (verse: TVerse) => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

interface VerseSelectionBlocksParams {
  selectedVerses: Record<string, boolean>
  // The verses of the version the selection is in, in the order the chapter shows them
  verses: TVerse[]
  version: string
  // Parallel reading: the column the handles stand in
  column?: number
  getTokens: (verseKey: string, text: string) => WordToken[]
}

/**
 * The selected verses that follow one another in the chapter, each block as the words it holds:
 * from the first word of its first verse to the last word of its last one. Dragging a handle of a
 * block turns it into a selection of words.
 */
export function getVerseSelectionBlocks({
  selectedVerses,
  verses,
  version,
  column,
  getTokens,
}: VerseSelectionBlocksParams): SelectionRange[] {
  const runs: TVerse[][] = []
  let previousWasSelected = false
  for (const verse of verses) {
    const isSelected = Boolean(selectedVerses[getVerseKey(verse)])
    if (isSelected && previousWasSelected) runs[runs.length - 1].push(verse)
    else if (isSelected) runs.push([verse])
    previousWasSelected = isSelected
  }

  return runs.flatMap(run => {
    const firstVerse = run[0]
    const lastVerse = run[run.length - 1]
    const firstWord = getTokens(getVerseKey(firstVerse), firstVerse.Texte).find(
      token => !token.isWhitespace
    )
    const lastWord = getTokens(getVerseKey(lastVerse), lastVerse.Texte)
      .filter(token => !token.isWhitespace)
      .at(-1)
    if (!firstWord || !lastWord) return []

    return [
      {
        start: { verseKey: getVerseKey(firstVerse), wordIndex: firstWord.index },
        end: { verseKey: getVerseKey(lastVerse), wordIndex: lastWord.index },
        version,
        ...(column === undefined ? {} : { column }),
      },
    ]
  })
}
