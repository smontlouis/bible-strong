export type StrongReferenceFamily = 'hebrew' | 'greek'

export type StrongLexiconEntry = {
  Code: string | number
  LSG: string
}

export type StrongSurfaceAlignment = {
  kind: 'surface'
  start: number
  end: number
  affinity: 'prefix' | 'postfix'
}

export type StrongUnalignedAlignment = {
  kind: 'unaligned'
}

export type StrongOccurrence = {
  id: string
  family: StrongReferenceFamily
  rawReference: string
  reference: string
  markerOffset: number
  morphology: string[]
  alignment: StrongSurfaceAlignment | StrongUnalignedAlignment
}

export type StrongMorphology = {
  id: string
  reference: string
  markerOffset: number
  lexicalOccurrenceId: string | null
}

export type StrongVerseRun =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'lexical'; text: string; reference: string; occurrenceId: string }
  | { id: string; type: 'standalone'; reference: string; occurrenceId: string }

export type StrongVerseModel = {
  visibleText: string
  runs: StrongVerseRun[]
  occurrences: StrongOccurrence[]
  morphology: StrongMorphology[]
  references: string[]
}

type DraftOccurrence = Omit<StrongOccurrence, 'alignment'>

type DraftMorphology = StrongMorphology

type Marker = {
  source: string
  morphologyReference?: string
  lexicalReferences: string[]
  index: number
  end: number
}

const ANNOTATION_PATTERN = /\(\d+\.\d+\)|\((\d{4})\)|(\d+)/gu
const WORD_PATTERN =
  /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*(?:[\-‐‑–—][\p{L}\p{M}\p{N}]+)*/gu
const VERSE_LABEL_PATTERN = /\(\d+\.\d+\)/gu
const WORD_CHARACTER_PATTERN = /[\p{L}\p{M}\p{N}]/u
const JOINER_PATTERN = /['’\-‐‑–—]/u
const POSTFIX_BOUNDARY_PATTERN = /[.,;:!?…()[\]{}"«»]/u

const canonicalizeReference = (reference: string | number): string => String(Number(reference))

const getReferenceFamily = (book: number): StrongReferenceFamily => (book > 39 ? 'greek' : 'hebrew')

const isValidReference = (
  reference: string,
  family: StrongReferenceFamily,
  allowLeadingZero = true
) => {
  if (!reference || (!allowLeadingZero && reference.length > 1 && reference.startsWith('0'))) {
    return false
  }

  const value = Number(reference)
  const maxReference = family === 'greek' ? 5624 : 8674
  return Number.isInteger(value) && value > 0 && value <= maxReference
}

const splitLexicalReferences = (source: string, family: StrongReferenceFamily): string[] => {
  if (source.length <= 5) {
    return isValidReference(source, family) ? [source] : []
  }

  const solutions = new Map<number, string[] | null>()
  const findBestSolution = (offset: number): string[] | null => {
    if (offset === source.length) return []
    if (solutions.has(offset)) return solutions.get(offset) ?? null

    let bestSolution: string[] | null = null
    for (let length = Math.min(5, source.length - offset); length >= 1; length -= 1) {
      const candidate = source.slice(offset, offset + length)
      if (!isValidReference(candidate, family, family === 'hebrew')) continue
      const remainder = findBestSolution(offset + length)
      if (!remainder) continue

      const solution = [candidate, ...remainder]
      const solutionScore = solution.reduce((score, reference) => score + reference.length ** 2, 0)
      const bestScore =
        bestSolution?.reduce((score, reference) => score + reference.length ** 2, 0) ?? -1
      if (
        !bestSolution ||
        solution.length < bestSolution.length ||
        (solution.length === bestSolution.length &&
          (solutionScore > bestScore ||
            (solutionScore === bestScore && solution[0].length < bestSolution[0].length)))
      ) {
        bestSolution = solution
      }
    }
    solutions.set(offset, bestSolution)
    return bestSolution
  }

  return findBestSolution(0) || []
}

const getRemovalRange = (
  source: string,
  markerStart: number,
  markerEnd: number
): { index: number; end: number } => {
  let index = markerStart
  let end = markerEnd
  const followingCharacter = source[markerEnd]
  let followingWhitespaceEnd = markerEnd
  while (/[\s\u00a0]/u.test(source[followingWhitespaceEnd] || '')) {
    followingWhitespaceEnd += 1
  }
  const nextVisibleCharacter = source[followingWhitespaceEnd]

  if (markerStart === 0) {
    end = followingWhitespaceEnd
    return { index, end }
  }

  let whitespaceStart = markerStart
  while (whitespaceStart > 0 && /[\s\u00a0]/u.test(source[whitespaceStart - 1])) {
    whitespaceStart -= 1
  }

  if (whitespaceStart < markerStart && !WORD_CHARACTER_PATTERN.test(followingCharacter || '')) {
    index = whitespaceStart
    if (JOINER_PATTERN.test(nextVisibleCharacter || '')) end = followingWhitespaceEnd
  } else if (
    whitespaceStart === markerStart &&
    JOINER_PATTERN.test(source[markerStart - 1] || '') &&
    /[\s\u00a0]/u.test(followingCharacter || '')
  ) {
    end = followingWhitespaceEnd
  }

  return { index, end }
}

const lexMarkers = (source: string, family: StrongReferenceFamily): Marker[] => {
  const markers: Marker[] = []

  for (const match of source.matchAll(ANNOTATION_PATTERN)) {
    const markerStart = match.index ?? 0
    const markerSource = match[0]
    if (markerSource.includes('.')) continue

    const markerEnd = markerStart + markerSource.length
    const removalRange = getRemovalRange(source, markerStart, markerEnd)
    const morphologyReference = match[1]
    const lexicalReferences = match[2] ? splitLexicalReferences(match[2], family) : []

    markers.push({
      source: markerSource,
      morphologyReference,
      lexicalReferences,
      index: removalRange.index,
      end: removalRange.end,
    })
  }

  return markers
}

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘]/gu, "'")
    .replace(/[‐‑–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('fr')

const getLexiconAliases = (translatedBy: string | undefined): string[] => {
  if (!translatedBy) return []

  const withoutHtml = translatedBy.replace(/<[^>]*>/gu, ' ')
  const withoutParentheticalExamples = withoutHtml.replace(/\([^)]*\)/gu, '')

  return withoutParentheticalExamples
    .split(/[;,]/gu)
    .map(alias =>
      alias
        .replace(/\s+\d+\s*$/u, '')
        .replace(/\.{2,}/gu, '')
        .trim()
    )
    .filter(alias => alias.length > 0 && normalizeForMatch(alias) !== 'non traduit')
}

const getExcludedVerseLabelRanges = (value: string, absoluteStart: number) =>
  [...value.matchAll(VERSE_LABEL_PATTERN)].map(match => ({
    start: absoluteStart + (match.index ?? 0),
    end: absoluteStart + (match.index ?? 0) + match[0].length,
  }))

const getWordRanges = (value: string, absoluteStart: number) => {
  const excludedRanges = getExcludedVerseLabelRanges(value, absoluteStart)

  return [...value.matchAll(WORD_PATTERN)]
    .map(match => ({
      start: absoluteStart + (match.index ?? 0),
      end: absoluteStart + (match.index ?? 0) + match[0].length,
    }))
    .filter(
      wordRange =>
        !excludedRanges.some(
          excludedRange =>
            wordRange.start >= excludedRange.start && wordRange.end <= excludedRange.end
        )
    )
}

const resolveSurfaceAlignment = ({
  visibleText,
  candidateStart,
  candidateEnd,
  markerOffset,
  translatedBy,
}: {
  visibleText: string
  candidateStart: number
  candidateEnd: number
  markerOffset: number
  translatedBy?: string
}): StrongSurfaceAlignment | StrongUnalignedAlignment => {
  const aliases = new Set(getLexiconAliases(translatedBy).map(normalizeForMatch))
  const normalizedLexicon = normalizeForMatch(translatedBy || '')
  if (normalizedLexicon === 'non traduit' || normalizedLexicon.startsWith('non traduit;')) {
    return { kind: 'unaligned' }
  }

  const postfixCandidate = visibleText.slice(candidateStart, markerOffset)
  const postfixWords = getWordRanges(postfixCandidate, candidateStart)
  const characterBeforeMarker = visibleText.slice(0, markerOffset).trimEnd().slice(-1)
  const startsNewSurface =
    postfixWords.length === 0 || POSTFIX_BOUNDARY_PATTERN.test(characterBeforeMarker)

  if (aliases.size > 0 && postfixWords.length > 0) {
    const surfaceEnd = postfixWords[postfixWords.length - 1].end
    for (const word of postfixWords) {
      const candidateSurface = visibleText.slice(word.start, surfaceEnd)
      if (aliases.has(normalizeForMatch(candidateSurface))) {
        return {
          kind: 'surface',
          start: word.start,
          end: surfaceEnd,
          affinity: 'postfix',
        }
      }
    }
  }

  const prefixCandidate = visibleText.slice(markerOffset, candidateEnd)
  const prefixWords = getWordRanges(prefixCandidate, markerOffset)
  if (startsNewSurface && aliases.size > 0 && prefixWords.length > 0) {
    const surfaceStart = prefixWords[0].start
    for (let index = prefixWords.length - 1; index >= 0; index -= 1) {
      const candidateSurface = visibleText.slice(surfaceStart, prefixWords[index].end)
      if (aliases.has(normalizeForMatch(candidateSurface))) {
        return {
          kind: 'surface',
          start: surfaceStart,
          end: prefixWords[index].end,
          affinity: 'prefix',
        }
      }
    }
  }

  if (!postfixWords.length) return { kind: 'unaligned' }
  if (POSTFIX_BOUNDARY_PATTERN.test(characterBeforeMarker)) return { kind: 'unaligned' }

  const fallbackWord = postfixWords[postfixWords.length - 1]
  return {
    kind: 'surface',
    start: fallbackWord.start,
    end: fallbackWord.end,
    affinity: 'postfix',
  }
}

const buildRuns = (visibleText: string, occurrences: StrongOccurrence[]): StrongVerseRun[] => {
  type RunEvent =
    | { type: 'lexical'; offset: number; end: number; occurrence: StrongOccurrence }
    | { type: 'standalone'; offset: number; end: number; occurrence: StrongOccurrence }

  const events: RunEvent[] = occurrences
    .map(occurrence => {
      if (occurrence.alignment.kind === 'surface') {
        return {
          type: 'lexical' as const,
          offset: occurrence.alignment.start,
          end: occurrence.alignment.end,
          occurrence,
        }
      }

      return {
        type: 'standalone' as const,
        offset: occurrence.markerOffset,
        end: occurrence.markerOffset,
        occurrence,
      }
    })
    .sort((first, second) => {
      if (first.offset !== second.offset) return first.offset - second.offset
      if (first.type !== second.type) return first.type === 'standalone' ? -1 : 1
      return Number(first.occurrence.id.split('-')[1]) - Number(second.occurrence.id.split('-')[1])
    })

  const runs: StrongVerseRun[] = []
  let cursor = 0

  const pushText = (text: string, start: number) => {
    if (!text) return
    const previousRun = runs[runs.length - 1]
    if (previousRun?.type === 'text') {
      previousRun.text += text
      return
    }
    runs.push({ id: `text-${start}`, type: 'text', text })
  }

  events.forEach(event => {
    if (event.offset < cursor) {
      runs.push({
        id: `standalone-${event.occurrence.id}`,
        type: 'standalone',
        reference: event.occurrence.reference,
        occurrenceId: event.occurrence.id,
      })
      return
    }

    pushText(visibleText.slice(cursor, event.offset), cursor)

    if (event.type === 'standalone') {
      runs.push({
        id: `standalone-${event.occurrence.id}`,
        type: 'standalone',
        reference: event.occurrence.reference,
        occurrenceId: event.occurrence.id,
      })
      cursor = event.offset
      return
    }

    runs.push({
      id: `surface-${event.occurrence.id}`,
      type: 'lexical',
      text: visibleText.slice(event.offset, event.end),
      reference: event.occurrence.reference,
      occurrenceId: event.occurrence.id,
    })
    cursor = event.end
  })

  pushText(visibleText.slice(cursor), cursor)
  return runs
}

export const parseStrongVerse = (
  source: string,
  book: number,
  lexiconEntries: StrongLexiconEntry[] = []
): StrongVerseModel => {
  const family = getReferenceFamily(book)
  const markers = lexMarkers(source, family)
  const occurrences: DraftOccurrence[] = []
  const morphology: DraftMorphology[] = []
  let visibleText = ''
  let cursor = 0

  markers.forEach(marker => {
    visibleText += source.slice(cursor, Math.max(cursor, marker.index))
    const markerOffset = visibleText.length

    if (marker.morphologyReference) {
      const lexicalOccurrence = occurrences[occurrences.length - 1]
      const morphologyReference = canonicalizeReference(marker.morphologyReference)
      lexicalOccurrence?.morphology.push(morphologyReference)
      morphology.push({
        id: `morphology-${morphology.length}`,
        reference: morphologyReference,
        markerOffset,
        lexicalOccurrenceId: lexicalOccurrence?.id || null,
      })
    } else {
      marker.lexicalReferences.forEach(lexicalReference => {
        occurrences.push({
          id: `lexical-${occurrences.length}`,
          family,
          rawReference: lexicalReference,
          reference: canonicalizeReference(lexicalReference),
          markerOffset,
          morphology: [],
        })
      })
    }

    cursor = Math.max(cursor, marker.end)
  })

  visibleText += source.slice(cursor)

  if (markers[0]?.index === 0) {
    const leadingWhitespaceLength = visibleText.match(/^[\s\u00a0]+/u)?.[0].length || 0
    if (leadingWhitespaceLength > 0) {
      visibleText = visibleText.slice(leadingWhitespaceLength)
      occurrences.forEach(occurrence => {
        occurrence.markerOffset = Math.max(0, occurrence.markerOffset - leadingWhitespaceLength)
      })
      morphology.forEach(morphologyMarker => {
        morphologyMarker.markerOffset = Math.max(
          0,
          morphologyMarker.markerOffset - leadingWhitespaceLength
        )
      })
    }
  }

  const lexiconByReference = new Map(
    lexiconEntries.map(entry => [canonicalizeReference(entry.Code), entry.LSG])
  )

  const resolvedOccurrences: StrongOccurrence[] = occurrences.map((occurrence, index) => {
    const nextDistinctOccurrence = occurrences
      .slice(index + 1)
      .find(candidate => candidate.markerOffset > occurrence.markerOffset)

    return {
      ...occurrence,
      alignment: resolveSurfaceAlignment({
        visibleText,
        candidateStart: index === 0 ? 0 : occurrences[index - 1].markerOffset,
        candidateEnd: nextDistinctOccurrence?.markerOffset ?? visibleText.length,
        markerOffset: occurrence.markerOffset,
        translatedBy: lexiconByReference.get(occurrence.reference),
      }),
    }
  })

  const occupiedSurfaces: StrongSurfaceAlignment[] = []
  const alignedOccurrences = resolvedOccurrences.map(occurrence => {
    if (occurrence.alignment.kind === 'unaligned') return occurrence

    const overlapsExistingSurface = occupiedSurfaces.some(
      surface =>
        occurrence.alignment.kind === 'surface' &&
        occurrence.alignment.start < surface.end &&
        occurrence.alignment.end > surface.start
    )
    if (overlapsExistingSurface) {
      return { ...occurrence, alignment: { kind: 'unaligned' } as const }
    }

    occupiedSurfaces.push(occurrence.alignment)
    return occurrence
  })

  const seenReferences = new Set<string>()
  const references = alignedOccurrences.reduce<string[]>((result, occurrence) => {
    if (!seenReferences.has(occurrence.reference)) {
      seenReferences.add(occurrence.reference)
      result.push(occurrence.reference)
    }
    return result
  }, [])

  return {
    visibleText,
    runs: buildRuns(visibleText, alignedOccurrences),
    occurrences: alignedOccurrences,
    morphology,
    references,
  }
}
