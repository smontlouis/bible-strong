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

export const shouldHideBibleViewerPersonalData = ({
  version,
  strongMode,
  interlinearMode,
}: {
  version: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
}): boolean =>
  strongMode === 'reverse-interlinear' ||
  (version === 'BHG' && isInterlinearModeEnabled(interlinearMode))

export const getBibleViewerPersonalData = (
  hidden: boolean,
  personalData: BibleViewerPersonalData
): BibleViewerPersonalData => (hidden ? EMPTY_BIBLE_VIEWER_PERSONAL_DATA : personalData)
