import type {
  AnnotationRange,
  WordAnnotationRealignmentUpdate,
  WordAnnotationsObj,
} from '~redux/modules/user/wordAnnotations'
import type { VersionCode } from '~state/tabs'
import { getTextFromWordIndices, tokenizeVerseText } from './wordTokenizer'

export interface WordAnnotationRealignmentPlan {
  updates: Record<string, WordAnnotationRealignmentUpdate>
  realignedRangeCount: number
  unchangedAmbiguousAnnotationIds: string[]
}

export const normalizeAnnotationComparisonText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/[’‘ʼ`´]/gu, "'")
    .replace(/[‐‑‒–—―]/gu, '-')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('fr')

export const planWordAnnotationRealignment = ({
  annotations,
  version,
  textRevision,
  candidateVerses,
  previousVersesByVersion = {},
}: {
  annotations: WordAnnotationsObj
  version: string
  textRevision: string
  candidateVerses: Record<string, string>
  previousVersesByVersion?: Record<string, Record<string, string>>
}): WordAnnotationRealignmentPlan => {
  const updates: WordAnnotationRealignmentPlan['updates'] = {}
  const unchangedAmbiguousAnnotationIds: string[] = []
  let realignedRangeCount = 0
  const sourceVersions = new Set<string>([version])

  for (const annotation of Object.values(annotations)) {
    if (!sourceVersions.has(annotation.version)) continue
    const targetVersion = version as VersionCode
    const versionChanged = annotation.version !== targetVersion
    if (!versionChanged && annotation.textRevision === textRevision) continue

    let everyRangeValidated = true
    let rangesChanged = false
    let annotationRealignedRangeCount = 0
    const nextRanges = annotation.ranges.map(range => {
      const candidateText = candidateVerses[range.verseKey]
      if (!candidateText) {
        everyRangeValidated = false
        return range
      }

      const candidateTokens = tokenizeVerseText(candidateText)
      const indexedText = getTextFromWordIndices(
        candidateTokens,
        range.startWordIndex,
        range.endWordIndex
      )
      if (
        normalizeAnnotationComparisonText(indexedText) ===
        normalizeAnnotationComparisonText(range.text)
      ) {
        return range
      }

      const matches = findRangeMatches(candidateText, range.text)
      const resolved = resolveUniqueMatch({
        matches,
        previousText: previousVersesByVersion[annotation.version]?.[range.verseKey],
        previousRange: range,
        candidateText,
      })
      if (!resolved) {
        everyRangeValidated = false
        return range
      }

      rangesChanged =
        rangesChanged ||
        resolved.startWordIndex !== range.startWordIndex ||
        resolved.endWordIndex !== range.endWordIndex
      if (
        resolved.startWordIndex !== range.startWordIndex ||
        resolved.endWordIndex !== range.endWordIndex
      ) {
        annotationRealignedRangeCount += 1
      }
      return {
        ...range,
        startWordIndex: resolved.startWordIndex,
        endWordIndex: resolved.endWordIndex,
      }
    })

    if (!everyRangeValidated) unchangedAmbiguousAnnotationIds.push(annotation.id)

    if (rangesChanged || versionChanged || everyRangeValidated) {
      updates[annotation.id] = {
        ranges: nextRanges,
        textRevision: everyRangeValidated ? textRevision : annotation.textRevision,
        ...(versionChanged ? { version: targetVersion } : {}),
      }
      realignedRangeCount += annotationRealignedRangeCount
    }
  }

  return {
    updates,
    realignedRangeCount,
    unchangedAmbiguousAnnotationIds,
  }
}

type RangeMatch = {
  startWordIndex: number
  endWordIndex: number
}

const findRangeMatches = (candidateText: string, savedText: string): RangeMatch[] => {
  const tokens = tokenizeVerseText(candidateText).filter(token => !token.isWhitespace)
  const expected = normalizeAnnotationComparisonText(savedText)
  if (!expected) return []

  const matches: RangeMatch[] = []
  for (let start = 0; start < tokens.length; start++) {
    for (let end = start; end < tokens.length; end++) {
      const text = tokens
        .slice(start, end + 1)
        .map(token => token.word)
        .join(' ')
      if (normalizeAnnotationComparisonText(text) === expected) {
        matches.push({
          startWordIndex: tokens[start].index,
          endWordIndex: tokens[end].index,
        })
      }
    }
  }
  return matches
}

const resolveUniqueMatch = ({
  matches,
  previousText,
  previousRange,
  candidateText,
}: {
  matches: RangeMatch[]
  previousText?: string
  previousRange: AnnotationRange
  candidateText: string
}): RangeMatch | undefined => {
  if (matches.length === 1) return matches[0]
  if (matches.length === 0 || !previousText) return undefined

  const previousWords = tokenizeVerseText(previousText).filter(token => !token.isWhitespace)
  const before = previousWords
    .slice(Math.max(previousRange.startWordIndex - 2, 0), previousRange.startWordIndex)
    .map(token => normalizeAnnotationComparisonText(token.word))
  const after = previousWords
    .slice(previousRange.endWordIndex + 1, previousRange.endWordIndex + 3)
    .map(token => normalizeAnnotationComparisonText(token.word))
  const candidateWords = tokenizeVerseText(candidateText).filter(token => !token.isWhitespace)

  const scored = matches
    .map(match => ({
      match,
      score:
        matchingSuffixLength(
          before,
          candidateWords
            .slice(Math.max(match.startWordIndex - before.length, 0), match.startWordIndex)
            .map(token => normalizeAnnotationComparisonText(token.word))
        ) +
        matchingPrefixLength(
          after,
          candidateWords
            .slice(match.endWordIndex + 1, match.endWordIndex + 1 + after.length)
            .map(token => normalizeAnnotationComparisonText(token.word))
        ),
    }))
    .sort((left, right) => right.score - left.score)

  if (scored[0]!.score === 0 || scored[0]!.score === scored[1]!.score) return undefined
  return scored[0]!.match
}

const matchingPrefixLength = (left: string[], right: string[]): number => {
  let count = 0
  while (count < left.length && left[count] === right[count]) count += 1
  return count
}

const matchingSuffixLength = (left: string[], right: string[]): number => {
  let count = 0
  while (count < left.length && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1
  }
  return count
}
