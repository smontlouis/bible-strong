import * as Haptics from 'expo-haptics'
import { getDefaultStore, type PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import type { BibleResource } from '~common/types'
import type { InlineCommentaryChip } from '~features/commentaries/inlineCommentaryPlacement'
import type { ReadingIndex } from '~features/resources/commentaryReadingAccess'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import type { StrongSelection } from '~helpers/strongSelection'
import { toast } from '~helpers/toast'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import {
  useBibleRouteNavigation,
  type BibleRouteNavigationAdapter,
} from '~state/bibleRouteNavigation'
import type { BibleTab, VersionCode } from '~state/tabs'
import { useBookAndVersionSelector } from '../BookSelectorSheet/BookSelectorSheetProvider'

/** What the reader is when an intent arrives. */
export type ReaderSnapshot = {
  tabId: string
  /** The Tab the reader shows, written through `world.store`. */
  tabAtom: PrimitiveAtom<BibleTab>
  /** The chapters the main version holds, once loaded: chapter changes follow them. */
  coverage?: BibleVersionCoverage
  /** Annotation mode, as far as the reader shows personal Bible data. */
  annotationMode: boolean
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
}

/**
 * What only `BibleViewer` holds: the text-mode sheets, the way on through a plan day, the Strong
 * sheet, the resources of a verse and the notes of the version's own text.
 */
export type ReaderPresentation =
  | { kind: 'column-text-mode'; mode: 'strong' | 'interlinear'; column: number }
  | { kind: 'plan-day-step' }
  | { kind: 'strong-selection'; selection: StrongSelection }
  | { kind: 'verse-resource'; resource: BibleResource; verseKey: string; version: VersionCode }
  | { kind: 'canonical-note'; note: CanonicalBibleNote }

export type Reader = {
  now(): ReaderSnapshot
  surface(presentation: ReaderPresentation): void
}

type RouteParams = Record<string, string | number | boolean | string[] | undefined>

/** A page of the application. */
export type ReaderRoute = { pathname: string; params?: RouteParams }

export type ReaderNotice = { type: 'info' | 'warning' | 'error'; message: string }

/** Everything a Reader intent reaches beyond the reader itself. */
export type ReaderWorld = {
  platform: typeof Platform.OS
  /** The Jotai store holding the Tab and the state of the application. */
  store: ReturnType<typeof getDefaultStore>
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
  return {
    platform: Platform.OS,
    store: getDefaultStore(),
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
    haptic: () => {
      void Haptics.selectionAsync()
    },
    t: (key, options) => t(key, options),
  }
}
