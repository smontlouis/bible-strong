export type StrongReference = {
  language: 'greek' | 'hebrew'
  number: number
  code: string
}

export type BibleTextSearchQuery = {
  kind: 'phrase' | 'terms'
  raw: string
  normalized: string
  terms: string[]
}

const APOSTROPHE_REGEX = /['‘’ʼʻ′＇]/gu
const QUOTE_PAIRS: Readonly<Record<string, string>> = {
  '"': '"',
  '“': '”',
  '«': '»',
}

const collapseWhitespace = (value: string) => value.replace(/\s+/gu, ' ').trim()
const LETTER_OR_NUMBER_REGEX = /[\p{L}\p{N}]/u

type FoldedSearchText = {
  value: string
  sourceOffsets: number[]
}

const foldBibleSearchText = (value: string): FoldedSearchText => {
  const folded: string[] = []
  const sourceOffsets: number[] = []
  let sourceOffset = 0

  for (const sourceCharacter of value) {
    const normalizedCharacters = sourceCharacter
      .normalize('NFD')
      .toLowerCase()
      .replace(/\p{M}+/gu, '')
      .replace(/ς/gu, 'σ')

    for (const character of normalizedCharacters) {
      if (LETTER_OR_NUMBER_REGEX.test(character)) {
        folded.push(character)
        sourceOffsets.push(sourceOffset)
      } else if (folded.length > 0 && folded.at(-1) !== ' ') {
        folded.push(' ')
        sourceOffsets.push(sourceOffset)
      }
    }

    sourceOffset += sourceCharacter.length
  }

  if (folded.at(-1) === ' ') {
    folded.pop()
    sourceOffsets.pop()
  }

  return { value: folded.join(''), sourceOffsets }
}

/**
 * Produces the storage-independent form used by tolerant Bible search.
 *
 * The original text remains the display source. This folded form deliberately:
 * - treats apostrophes and punctuation as token boundaries;
 * - removes Latin and Greek diacritics;
 * - removes Hebrew niqqud and cantillation marks;
 * - treats the two lowercase Greek sigma forms as equivalent.
 */
export const normalizeBibleSearchText = (value: string): string =>
  collapseWhitespace(foldBibleSearchText(value.replace(APOSTROPHE_REGEX, ' ')).value)

export const parseStrongReference = (value: string): StrongReference | null => {
  const match = value.trim().match(/^([gh])\s*0*(\d+)$/iu)
  if (!match) return null

  const number = Number(match[2])
  if (!Number.isSafeInteger(number) || number < 1) return null

  const prefix = match[1].toUpperCase() as 'G' | 'H'

  return {
    language: prefix === 'G' ? 'greek' : 'hebrew',
    number,
    code: `${prefix}${number}`,
  }
}

const unwrapPhrase = (value: string): string | null => {
  const closingQuote = QUOTE_PAIRS[value[0]]
  if (!closingQuote || value.at(-1) !== closingQuote) return null

  const phrase = value.slice(1, -1).trim()
  return phrase || null
}

export const parseBibleTextSearchQuery = (value: string): BibleTextSearchQuery | null => {
  const raw = value.trim()
  if (!raw) return null

  const phrase = unwrapPhrase(raw)
  const normalized = normalizeBibleSearchText(phrase ?? raw)
  if (!normalized) return null

  return {
    kind: phrase === null ? 'terms' : 'phrase',
    raw: phrase ?? raw,
    normalized,
    terms: normalized.split(' '),
  }
}

type SourceRange = { start: number; end: number }

const getSourceCharacterEnd = (text: string, offset: number): number => {
  const firstCharacter = Array.from(text.slice(offset))[0]
  if (!firstCharacter) return offset

  let end = offset + firstCharacter.length
  for (const followingCharacter of text.slice(end)) {
    if (!/^\p{M}+$/u.test(followingCharacter)) break
    end += followingCharacter.length
  }
  return end
}

const mergeSourceRanges = (ranges: SourceRange[]): SourceRange[] =>
  ranges
    .sort((left, right) => left.start - right.start)
    .reduce<SourceRange[]>((merged, range) => {
      const previous = merged.at(-1)
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end)
      } else {
        merged.push({ ...range })
      }
      return merged
    }, [])

/** Adds the existing `{{...}}` display markers while preserving original script and accents. */
export const highlightBibleSearchText = (text: string, rawQuery: string): string => {
  const query = parseBibleTextSearchQuery(rawQuery)
  if (!query) return text

  const foldedText = foldBibleSearchText(text.replace(APOSTROPHE_REGEX, ' '))
  const normalizedMatches: SourceRange[] = []
  const needles = query.kind === 'phrase' ? [query.normalized] : query.terms

  for (const needle of needles) {
    let fromIndex = 0
    while (fromIndex < foldedText.value.length) {
      const start = foldedText.value.indexOf(needle, fromIndex)
      if (start === -1) break

      const isTokenStart = start === 0 || foldedText.value[start - 1] === ' '
      const isValidEnd =
        query.kind === 'terms' ||
        start + needle.length === foldedText.value.length ||
        foldedText.value[start + needle.length] === ' '

      if (isTokenStart && isValidEnd) {
        const sourceStart = foldedText.sourceOffsets[start]
        const sourceEndOffset = foldedText.sourceOffsets[start + needle.length - 1]
        if (sourceStart !== undefined && sourceEndOffset !== undefined) {
          normalizedMatches.push({
            start: sourceStart,
            end: getSourceCharacterEnd(text, sourceEndOffset),
          })
        }
      }

      fromIndex = start + Math.max(needle.length, 1)
    }
  }

  return mergeSourceRanges(normalizedMatches)
    .sort((left, right) => right.start - left.start)
    .reduce(
      (highlighted, range) =>
        `${highlighted.slice(0, range.start)}{{${highlighted.slice(
          range.start,
          range.end
        )}}}${highlighted.slice(range.end)}`,
      text
    )
}

const boundedEditDistance = (left: string, right: string, maximum: number): number => {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    let rowMinimum = current[0]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const distance = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      )
      current.push(distance)
      rowMinimum = Math.min(rowMinimum, distance)
    }
    if (rowMinimum > maximum) return maximum + 1
    previous = current
  }

  return previous[right.length]
}

export const findClosestBibleSearchTerm = (
  term: string,
  candidates: readonly string[]
): string | undefined => {
  if (term.length < 4) return undefined
  const maximumDistance = term.length <= 5 ? 1 : 2

  return candidates
    .map(candidate => ({
      candidate,
      distance: boundedEditDistance(term, candidate, maximumDistance),
    }))
    .filter(result => result.distance <= maximumDistance)
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        Math.abs(left.candidate.length - term.length) -
          Math.abs(right.candidate.length - term.length) ||
        left.candidate.localeCompare(right.candidate)
    )[0]?.candidate
}

export const highlightFuzzyBibleSearchText = (text: string, rawQuery: string): string => {
  const query = parseBibleTextSearchQuery(rawQuery)
  if (!query || query.kind === 'phrase') return text

  const candidates = normalizeBibleSearchText(text).split(' ')
  const correctedQuery = query.terms
    .map(term => findClosestBibleSearchTerm(term, candidates) ?? term)
    .join(' ')

  return highlightBibleSearchText(text, correctedQuery)
}
