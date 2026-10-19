import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import { isInterlinearModeEnabled } from '~helpers/interlinearDisplayMode'
import type { StrongMode } from '~helpers/strongBiblePublications'
import type { WebViewProps } from './BibleDOM/BibleDOMWrapper'

type BibleViewerPersonalData = Pick<
  WebViewProps,
  | 'isSelectionMode'
  | 'selectedVerses'
  | 'highlightedVerses'
  | 'notedVerses'
  | 'allNotes'
  | 'bookmarkedVerses'
  | 'linkedVerses'
  | 'allLinks'
  | 'studyRelations'
  | 'wordAnnotations'
  | 'annotationMode'
  | 'wordAnnotationsInOtherVersions'
  | 'taggedVersesInChapter'
  | 'versesWithNonHighlightTags'
>

const EMPTY_BIBLE_VIEWER_PERSONAL_DATA: BibleViewerPersonalData = {
  isSelectionMode: undefined,
  selectedVerses: {},
  highlightedVerses: {},
  notedVerses: {},
  allNotes: {},
  bookmarkedVerses: {},
  linkedVerses: {},
  allLinks: {},
  studyRelations: {},
  wordAnnotations: {},
  annotationMode: false,
  wordAnnotationsInOtherVersions: {},
  taggedVersesInChapter: {},
  versesWithNonHighlightTags: {},
}

type BibleViewerColumn = {
  version: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
}

/**
 * A column showing an interlinear presentation is read, not annotated: personal Bible data stays
 * out of it (ADR-0013, ADR-0014).
 */
export const isInterlinearReadingColumn = ({
  version,
  strongMode,
  interlinearMode,
}: BibleViewerColumn): boolean =>
  strongMode === 'reverse-interlinear' ||
  (version === 'BHG' && isInterlinearModeEnabled(interlinearMode))

/** Personal Bible data leaves the viewer only when none of its columns can hold it. */
export const shouldHideBibleViewerPersonalData = (columns: readonly BibleViewerColumn[]): boolean =>
  columns.every(isInterlinearReadingColumn)

/**
 * The versions whose every column shows an interlinear presentation. A version shown twice keeps
 * its personal data while one of its columns shows its text.
 */
export const getInterlinearReadingVersions = (columns: readonly BibleViewerColumn[]): string[] => {
  const versions = new Set(columns.map(column => column.version))
  return [...versions].filter(version =>
    columns.filter(column => column.version === version).every(isInterlinearReadingColumn)
  )
}

export const getBibleViewerPersonalData = (
  hidden: boolean,
  personalData: BibleViewerPersonalData
): BibleViewerPersonalData => (hidden ? EMPTY_BIBLE_VIEWER_PERSONAL_DATA : personalData)
