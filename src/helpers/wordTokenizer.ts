/**
 * Word Tokenizer for Bible verse annotations
 *
 * Splits verse text into word tokens with indices for annotation tracking.
 * Word indices are 0-indexed and count only actual words (not whitespace).
 */

export interface WordToken {
  word: string
  index: number // 0-indexed word position
  isWhitespace: boolean
  charStart: number // Character offset start in the original text
  charEnd: number // Character offset end (exclusive)
}

/**
 * Tokenizes verse text into word tokens with indices
 * Uses regex /(\\S+|\\s+)/g to split into words and whitespace
 *
 * @param text - Verse text to tokenize
 * @returns Array of word tokens with indices
 */
export function tokenizeVerseText(text: string): WordToken[] {
  if (!text) return []

  const regex = /(\S+|\s+)/g
  let match: RegExpExecArray | null
  let wordIndex = 0
  const tokens: WordToken[] = []

  while ((match = regex.exec(text)) !== null) {
    const word = match[0]
    const isWhitespace = /^\s+$/.test(word)
    const charStart = match.index
    const charEnd = match.index + word.length

    tokens.push({
      word,
      index: isWhitespace ? -1 : wordIndex,
      isWhitespace,
      charStart,
      charEnd,
    })

    if (!isWhitespace) {
      wordIndex++
    }
  }

  return tokens
}

/**
 * Gets the word index from a character offset position.
 * Used to convert caretRangeFromPoint positions to word indices for annotation mode.
 *
 * @param tokens - Array of word tokens
 * @param charOffset - Character offset in the text
 * @returns The word index at the given position, or null if not found
 */
export function getWordIndexFromCharOffset(tokens: WordToken[], charOffset: number): number | null {
  // Find the token that contains this character offset
  for (const token of tokens) {
    if (charOffset >= token.charStart && charOffset < token.charEnd) {
      // If it's whitespace, find the closest word (prefer the one after)
      if (token.isWhitespace) {
        const nextWord = tokens.find(t => !t.isWhitespace && t.charStart >= token.charEnd)
        const prevWord = [...tokens]
          .reverse()
          .find(t => !t.isWhitespace && t.charEnd <= token.charStart)

        // Prefer the word after the whitespace
        if (nextWord) return nextWord.index
        if (prevWord) return prevWord.index
        return null
      }
      return token.index
    }
  }

  // If charOffset is at the very end of text, return the last word
  const lastWord = [...tokens].reverse().find(t => !t.isWhitespace)
  if (lastWord && charOffset >= lastWord.charEnd) {
    return lastWord.index
  }

  // If charOffset is at the very beginning, return the first word
  const firstWord = tokens.find(t => !t.isWhitespace)
  if (firstWord && charOffset <= firstWord.charStart) {
    return firstWord.index
  }

  return null
}

/**
 * Gets the token (word or whitespace) that contains a given character offset.
 *
 * @param tokens - Array of word tokens
 * @param charOffset - Character offset in the text
 * @returns The token at the given position, or null if not found
 */
export function getTokenAtCharOffset(tokens: WordToken[], charOffset: number): WordToken | null {
  for (const token of tokens) {
    if (charOffset >= token.charStart && charOffset < token.charEnd) {
      return token
    }
  }
  return null
}

/**
 * Gets the word token by its word index.
 *
 * @param tokens - Array of word tokens
 * @param wordIndex - The 0-indexed word position
 * @returns The word token, or null if not found
 */
export function getTokenByWordIndex(tokens: WordToken[], wordIndex: number): WordToken | null {
  return tokens.find(t => !t.isWhitespace && t.index === wordIndex) || null
}

/**
 * Checks if a word index is within an annotation range (inclusive)
 *
 * @param wordIndex - 0-indexed word position
 * @param startWordIndex - Range start (inclusive)
 * @param endWordIndex - Range end (inclusive)
 * @returns true if word is in range
 */
export function isWordInRange(
  wordIndex: number,
  startWordIndex: number,
  endWordIndex: number
): boolean {
  return wordIndex >= startWordIndex && wordIndex <= endWordIndex
}

/**
 * Merges consecutive word indices into ranges
 * Example: [0, 1, 2, 5, 6] => [[0, 2], [5, 6]]
 *
 * @param wordIndices - Array of word indices
 * @returns Array of [start, end] ranges
 */
export function mergeToRanges(wordIndices: number[]): [number, number][] {
  if (wordIndices.length === 0) return []

  // Sort indices
  const sorted = [...wordIndices].sort((a, b) => a - b)

  const ranges: [number, number][] = []
  let currentStart = sorted[0]
  let currentEnd = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const index = sorted[i]

    if (index === currentEnd + 1) {
      // Consecutive - extend range
      currentEnd = index
    } else {
      // Gap - save current range and start new one
      ranges.push([currentStart, currentEnd])
      currentStart = index
      currentEnd = index
    }
  }

  // Save last range
  ranges.push([currentStart, currentEnd])

  return ranges
}

/**
 * Extracts text from word tokens within a range
 *
 * @param tokens - Array of word tokens
 * @param startWordIndex - Range start (0-indexed)
 * @param endWordIndex - Range end (0-indexed, inclusive)
 * @returns Extracted text
 */
export function getTextFromWordIndices(
  tokens: WordToken[],
  startWordIndex: number,
  endWordIndex: number
): string {
  const relevantTokens = tokens.filter(
    token => !token.isWhitespace && isWordInRange(token.index, startWordIndex, endWordIndex)
  )

  return relevantTokens.map(t => t.word).join(' ')
}

/**
 * Gets the total word count from tokens (excludes whitespace)
 *
 * @param tokens - Array of word tokens
 * @returns Number of words
 */
export function getWordCount(tokens: WordToken[]): number {
  return tokens.filter(t => !t.isWhitespace).length
}

/**
 * Checks if a word index is adjacent to any range in the list
 * Adjacent means wordIndex === range[0] - 1 (before) or wordIndex === range[1] + 1 (after)
 *
 * @param wordIndex - Word index to check
 * @param ranges - Array of [start, end] ranges
 * @returns Object with adjacency info
 */
export function isAdjacentToRange(
  wordIndex: number,
  ranges: [number, number][]
): { adjacent: boolean; rangeIndex: number; position: 'before' | 'after' | null } {
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i]

    // Check if word is just before the range
    if (wordIndex === start - 1) {
      return { adjacent: true, rangeIndex: i, position: 'before' }
    }

    // Check if word is just after the range
    if (wordIndex === end + 1) {
      return { adjacent: true, rangeIndex: i, position: 'after' }
    }
  }

  return { adjacent: false, rangeIndex: -1, position: null }
}

/**
 * Extends a range to include an adjacent word
 * Returns new array of ranges (may merge ranges if the new word connects two ranges)
 *
 * @param ranges - Array of [start, end] ranges
 * @param rangeIndex - Index of the range to extend
 * @param wordIndex - Word index to add
 * @returns New array of ranges with extended range
 */
export function extendRange(
  ranges: [number, number][],
  rangeIndex: number,
  wordIndex: number
): [number, number][] {
  const newRanges = [...ranges]
  const range = newRanges[rangeIndex]

  if (wordIndex === range[0] - 1) {
    // Extend at the beginning
    newRanges[rangeIndex] = [wordIndex, range[1]]
  } else if (wordIndex === range[1] + 1) {
    // Extend at the end
    newRanges[rangeIndex] = [range[0], wordIndex]
  }

  // Check if ranges should be merged (if new word connects two ranges)
  return mergeAdjacentRanges(newRanges)
}

/**
 * Merges ranges that have become adjacent after extension
 *
 * @param ranges - Array of [start, end] ranges
 * @returns Array with adjacent ranges merged
 */
function mergeAdjacentRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length <= 1) return ranges

  // Sort by start index
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    // If current range starts right after last range ends, merge them
    if (current[0] === last[1] + 1) {
      merged[merged.length - 1] = [last[0], current[1]]
    } else {
      merged.push(current)
    }
  }

  return merged
}

/**
 * Removes a word from ranges (may split a range into two)
 *
 * @param ranges - Array of [start, end] ranges
 * @param wordIndex - Word index to remove
 * @returns New array of ranges with word removed
 */
export function removeWordFromRange(
  ranges: [number, number][],
  wordIndex: number
): [number, number][] {
  const newRanges: [number, number][] = []

  for (const [start, end] of ranges) {
    if (wordIndex < start || wordIndex > end) {
      // Word not in this range, keep it unchanged
      newRanges.push([start, end])
    } else if (wordIndex === start && wordIndex === end) {
      // Single-word range, remove entirely (don't add to newRanges)
    } else if (wordIndex === start) {
      // Word is at the start, shrink from beginning
      newRanges.push([start + 1, end])
    } else if (wordIndex === end) {
      // Word is at the end, shrink from end
      newRanges.push([start, end - 1])
    } else {
      // Word is in the middle, split into two ranges
      newRanges.push([start, wordIndex - 1])
      newRanges.push([wordIndex + 1, end])
    }
  }

  return newRanges
}

/**
 * Checks if a word index is inside any of the ranges
 *
 * @param wordIndex - Word index to check
 * @param ranges - Array of [start, end] ranges
 * @returns Index of the range containing the word, or -1 if not found
 */
export function findRangeContainingWord(wordIndex: number, ranges: [number, number][]): number {
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i]
    if (wordIndex >= start && wordIndex <= end) {
      return i
    }
  }
  return -1
}
