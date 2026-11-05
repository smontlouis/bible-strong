import { getDefaultStore, type PrimitiveAtom } from 'jotai/vanilla'
import { Platform } from 'react-native'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import {
  useBibleRouteNavigation,
  type BibleRouteNavigationAdapter,
} from '~state/bibleRouteNavigation'
import type { BibleTab } from '~state/tabs'
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
}

/** What only `BibleViewer` holds: the text-mode sheets and the way on through a plan day. */
export type ReaderPresentation =
  | { kind: 'column-text-mode'; mode: 'strong' | 'interlinear'; column: number }
  | { kind: 'plan-day-step' }

export type Reader = {
  now(): ReaderSnapshot
  surface(presentation: ReaderPresentation): void
}

/** Everything a Reader intent reaches beyond the reader itself. */
export type ReaderWorld = {
  platform: typeof Platform.OS
  /** The Jotai store holding the Tab and the state of the application. */
  store: ReturnType<typeof getDefaultStore>
  /** The routes of a public Bible page, which replace the Tab's own navigation on the web. */
  routes?: BibleRouteNavigationAdapter
  openVersionSelector: ReturnType<typeof useBookAndVersionSelector>['openVersionSelector']
}

export const useReaderWorld = (): ReaderWorld => {
  const { openVersionSelector } = useBookAndVersionSelector()
  const routes = useBibleRouteNavigation()
  return {
    platform: Platform.OS,
    store: getDefaultStore(),
    routes,
    openVersionSelector,
  }
}
