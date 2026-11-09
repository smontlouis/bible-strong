import { produce } from 'immer'

import type { Book } from '~assets/bible_versions/books-desc'
import type { StudyNavigateBibleType } from '~common/types'
import { getBook } from '~helpers/bibleBookCatalog'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import generateUUID from '~helpers/generateUUID'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import type { StrongMode } from '~helpers/strongBiblePublications'
import {
  type BibleContextDisplayMode,
  type BiblePlanPassage,
  type BibleTab,
  getDefaultBibleTab,
  type VersionCode,
} from '~state/tabs'
import type { PublicBibleRoute } from './publicBibleRoutes'

/** Where a Bible route opens the reader. */
export type BibleRouteInput = {
  focusVerses?: number[]
  isSelectionMode?: string
  contextDisplayMode?: BibleContextDisplayMode
  book?: Book | number
  chapter?: number
  verse?: number
  version: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
  annotationId?: string
  /** Last chapter of a reading-plan passage starting at `chapter`; opens the reader in plan mode. */
  planEndChapter?: number
  /** The element of a plan day the passage is. */
  planEntity?: BiblePlanPassage['entity']
}

/** What a public Bible address asks of the reader (ADR-0053). */
export const bibleRouteInputFromPublicRoute = (route: PublicBibleRoute): BibleRouteInput => {
  const passage = route.passage
  const focusVerses = passage
    ? Array.from(
        { length: (passage.endVerse ?? passage.startVerse) - passage.startVerse + 1 },
        (_, index) => passage.startVerse + index
      )
    : undefined
  const strongMode: StrongMode =
    route.presentation === 'strong'
      ? 'visible'
      : route.presentation === 'transliteration' || route.presentation === 'reverse-interlinear'
        ? route.presentation
        : 'hidden'

  return {
    version: route.version,
    book: route.book,
    chapter: route.chapter,
    verse: passage?.startVerse,
    focusVerses,
    contextDisplayMode: passage ? 'focused' : 'fullChapter',
    strongMode,
    interlinearMode: route.presentation === 'interlinear' ? 'interlinear' : undefined,
    interlinearLocale: route.glossLanguage,
  }
}

/** The Bible Tab a route opens: the reader of the route panel, or a Tab of its own. */
export const createBibleRouteTab = ({
  focusVerses,
  isSelectionMode,
  contextDisplayMode,
  book,
  chapter,
  verse,
  version,
  strongMode,
  interlinearMode,
  interlinearLocale,
  planEndChapter,
  planEntity,
}: BibleRouteInput): BibleTab =>
  produce(getDefaultBibleTab(version as VersionCode), draft => {
    draft.id = `bible-${generateUUID()}`
    if (book)
      draft.data.selectedBook = Number.isInteger(book)
        ? getBook(book as number) || getBook(1)!
        : (book as Book)

    if (chapter) draft.data.selectedChapter = chapter
    if (verse !== undefined) draft.data.selectedVerse = verse
    if (focusVerses) draft.data.focusVerses = focusVerses
    if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode as StudyNavigateBibleType
    if (contextDisplayMode) {
      draft.data.contextDisplayMode = contextDisplayMode
    }
    if (strongMode) draft.data.strongMode = strongMode
    if (interlinearMode) draft.data.interlinearMode = interlinearMode
    if (interlinearLocale) draft.data.interlinearLocale = interlinearLocale
    if (planEndChapter && chapter)
      draft.data.planPassage = {
        book: draft.data.selectedBook.Numero,
        startChapter: chapter,
        endChapter: Math.max(chapter, planEndChapter),
        ...(planEntity ? { entity: planEntity } : {}),
      }
  })
