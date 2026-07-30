import type { Verse } from '~common/types'

type StrongSelectionDOMContext = {
  version: string
  book: number
  chapter: number
  strongMode?: string
  interlinearMode?: string
  interlinearLocale?: string
  parallelVersions: readonly string[]
  focusVerses?: readonly (string | number)[]
  contextDisplayMode: string
  renderedContentKey: string
  relationItemsKey: string
  annotationModeEnabled: boolean
  strongRelationItemsVisible: boolean
}

type ParallelVerseContent = {
  id: string
  verses: readonly Verse[]
}

const updateContentHash = (hash: number, value: unknown): number => {
  const text = typeof value === 'string' ? value : JSON.stringify(value) || ''
  let nextHash = hash

  for (let index = 0; index < text.length; index += 1) {
    nextHash ^= text.charCodeAt(index)
    nextHash = Math.imul(nextHash, 16777619)
  }

  return nextHash
}

const updateVerseContentHash = (hash: number, verse: Verse): number =>
  [
    verse.Livre,
    verse.Chapitre,
    verse.Verset,
    verse.Texte,
    verse.TextRevision,
    verse.StrongSpans,
    verse.InterlinearTokens,
    verse.ReverseInterlinearSpans,
  ].reduce(updateContentHash, hash)

export const getStrongSelectionRenderedContentKey = (
  verses: readonly Verse[],
  parallelContent: readonly ParallelVerseContent[]
): string => {
  let hash = verses.reduce(updateVerseContentHash, 2166136261)

  for (const parallel of parallelContent) {
    hash = updateContentHash(hash, parallel.id)
    hash = parallel.verses.reduce(updateVerseContentHash, hash)
  }

  return `${verses.length}:${parallelContent.map(content => content.verses.length).join(',')}:${(
    hash >>> 0
  ).toString(36)}`
}

export const getStrongSelectionRelationItemsKey = (studyRelations: unknown): string =>
  (updateContentHash(2166136261, studyRelations) >>> 0).toString(36)

export const shouldDismissStrongSelectionForViewerState = ({
  isActiveBibleTab,
  isFormSheet,
  isInTab,
}: {
  isActiveBibleTab: boolean
  isFormSheet?: boolean
  isInTab?: boolean
}): boolean => Boolean(isInTab) && !isFormSheet && !isActiveBibleTab

export const getStrongSelectionDOMContextKey = ({
  version,
  book,
  chapter,
  strongMode,
  interlinearMode,
  interlinearLocale,
  parallelVersions,
  focusVerses,
  contextDisplayMode,
  renderedContentKey,
  relationItemsKey,
  annotationModeEnabled,
  strongRelationItemsVisible,
}: StrongSelectionDOMContext): string =>
  JSON.stringify([
    version,
    book,
    chapter,
    strongMode,
    interlinearMode,
    interlinearLocale,
    parallelVersions,
    focusVerses,
    contextDisplayMode,
    renderedContentKey,
    relationItemsKey,
    annotationModeEnabled,
    strongRelationItemsVisible,
  ])
