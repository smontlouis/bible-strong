import * as Haptics from 'expo-haptics'
import { getDefaultStore, type PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import { useDispatch, useStore } from 'react-redux'
import type { BibleResource, Bookmark, Verse } from '~common/types'
import { useUnifiedTagsModal } from '~common/UnifiedTagsModalProvider'
import type { InlineCommentaryChip } from '~features/commentaries/inlineCommentaryPlacement'
import type { ReadingIndex } from '~features/resources/commentaryReadingAccess'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import type { StrongSelection } from '~helpers/strongSelection'
import { toast } from '~helpers/toast'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RootState } from '~redux/modules/reducer'
import type { WordAnnotationsObj } from '~redux/modules/user'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import type { AppDispatch } from '~redux/store'
import type { UnifiedTagsModalProps } from '~state/app'
import {
  useBibleRouteNavigation,
  type BibleRouteNavigationAdapter,
} from '~state/bibleRouteNavigation'
import type { BibleTab, VersionCode } from '~state/tabs'
import { useBookAndVersionSelector } from '../BookSelectorSheet/BookSelectorSheetProvider'
import type { AnnotationSessionState } from '../hooks/annotationSession'

/** What the reader is when an intent arrives. */
export type ReaderSnapshot = {
  tabId: string
  /** The Tab the reader shows, written through `world.store`. */
  tabAtom: PrimitiveAtom<BibleTab>
  /** The chapters the main version holds, once loaded: chapter changes follow them. */
  coverage?: BibleVersionCoverage
  /** Annotation mode, as far as the reader shows personal Bible data. */
  annotationMode: boolean
  /** The annotation session of the reader: the mode, the words selected, the annotation picked. */
  annotationSession: PrimitiveAtom<AnnotationSessionState>
  /** The verses of each version on screen, as the page shows them: Word annotations read them. */
  versesByVersion: Partial<Record<VersionCode, Verse[]>>
  isFormSheet: boolean
  /** A wide screen keeps the controls visible. */
  keepControlsVisible: boolean
  /** The passage leads on to the next element of its plan day. */
  hasPlanDayStep: boolean
  /** Every column shows an interlinear presentation: the reader holds no personal Bible data. */
  hidesPersonalData: boolean
  /**
   * The versions whose every column shows an interlinear presentation (ADR-0030). A version shown
   * twice keeps its personal data while one of its columns shows its text.
   */
  interlinearReadingVersions: VersionCode[]
  /** The versions of the parallel columns on screen, after the main one. */
  parallelColumnVersions: VersionCode[]
  /** The commentaries shown within the text, and the indexes of the chapter they come from. */
  inlineCommentaries: { chips: InlineCommentaryChip[]; indexes: ReadingIndex[] }
  /** The bookmarks of the chapter, by verse, as the page shows them. */
  bookmarks: Record<number, Bookmark>
  /**
   * The Word annotations of the chapter, as the page shows them: their ranges carry no words, the
   * stored annotations do.
   */
  wordAnnotations: WordAnnotationsObj
  /** By verse, the versions not on screen that hold Word annotations of it. */
  wordAnnotationsInOtherVersions: Record<string, CrossVersionAnnotation[]>
}

/**
 * What only `BibleViewer` holds: the text-mode sheets, the way on through a plan day, the Strong
 * sheet, the resources of a verse, the notes of the version's own text, the bookmark sheet, the
 * Word annotations of a verse in other versions and the tags of a verse.
 */
export type ReaderPresentation =
  | { kind: 'column-text-mode'; mode: 'strong' | 'interlinear'; column: number }
  | { kind: 'plan-day-step' }
  | { kind: 'strong-selection'; selection: StrongSelection }
  | { kind: 'verse-resource'; resource: BibleResource; verseKey: string; version: VersionCode }
  | { kind: 'canonical-note'; note: CanonicalBibleNote }
  | { kind: 'bookmark'; bookmark: Bookmark }
  | { kind: 'cross-version-annotations'; verseKey: string; versions: CrossVersionAnnotation[] }
  | { kind: 'verse-tags'; verseKey: string }

export type Reader = {
  now(): ReaderSnapshot
  surface(presentation: ReaderPresentation): void
}

type RouteParams = Record<string, string | number | boolean | string[] | undefined>

/** A page of the application. */
export type ReaderRoute = { pathname: string; params?: RouteParams }

export type ReaderNotice = { type: 'info' | 'warning' | 'error'; message: string }

/** What the tags sheet is asked to tag. */
export type ReaderTagsSheet = Exclude<UnifiedTagsModalProps, false>

/** Everything a Reader intent reaches beyond the reader itself. */
export type ReaderWorld = {
  platform: typeof Platform.OS
  /** The Jotai store holding the Tab and the state of the application. */
  store: ReturnType<typeof getDefaultStore>
  /** The Redux store of the user's data: Word annotations are written there. */
  dispatch: AppDispatch
  /** The user's data as stored, words of the Word annotations included. */
  getState(): RootState
  /** The routes of a public Bible page, which replace the Tab's own navigation on the web. */
  routes?: BibleRouteNavigationAdapter
  openVersionSelector: ReturnType<typeof useBookAndVersionSelector>['openVersionSelector']
  /** Opens a page of the application, unless it is already the one on screen. */
  navigate(route: ReaderRoute): void
  /** Opens the page of a study object a Relation endpoint describes. */
  openStudyObject(endpoint: RelationEndpoint): void
  /** Opens an address outside the application. */
  openUrl(url: string): Promise<void>
  notify(notice: ReaderNotice): void
  /** Opens the tags sheet, the one of the screen the reader sits in. */
  openTags(sheet: ReaderTagsSheet): void
  /** The feedback of the device under the finger. */
  haptic(feedback: 'selection'): void
  t(key: string, options?: Record<string, unknown>): string
}

export const useReaderWorld = (): ReaderWorld => {
  const { openVersionSelector } = useBookAndVersionSelector()
  const routes = useBibleRouteNavigation()
  const pushRouteOnce = usePushRouteOnce()
  const openStudyObject = useOpenStudyObject()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const reduxStore = useStore<RootState>()
  const openTags = useUnifiedTagsModal()
  return {
    platform: Platform.OS,
    store: getDefaultStore(),
    dispatch,
    getState: () => reduxStore.getState(),
    routes,
    openVersionSelector,
    navigate: route => pushRouteOnce(route as Parameters<typeof pushRouteOnce>[0]),
    openStudyObject: endpoint => openStudyObject({ endpoint }),
    openUrl: async url => {
      await Linking.openURL(url)
    },
    notify: ({ type, message }) => {
      if (type === 'warning') toast.warning(message)
      else if (type === 'error') toast.error(message)
      else toast.info(message)
    },
    openTags,
    haptic: () => {
      void Haptics.selectionAsync()
    },
    t: (key, options) => t(key, options),
  }
}
