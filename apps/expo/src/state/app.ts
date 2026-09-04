import { atom } from 'jotai/vanilla'
import { Tag, VerseIds } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  addHistoryItem,
  HistoryItem,
  HistoryItemInput,
  migrateHistoryItems,
} from '~features/history/historyModel'
import {
  tabGroupsAtom,
  activeGroupIdAtom,
  cachedTabIdsAtom,
  createDefaultGroup,
  DEFAULT_GROUP_ID,
  appSwitcherModeAtom,
} from './tabs'
import { entitiesArray } from '~redux/modules/user/tags'

export interface Diff {
  added?: Record<string, unknown>
  updated?: unknown
  deleted?: unknown
}

export const isFullScreenBibleAtom = atom(false)
export const isBibleOverlayOpenAtom = atom(false)

export const IAPInitializedAtom = atom(false)

export type UnifiedTagsModalProps =
  | {
      mode: 'filter'
      selectedTag?: Tag
      onSelect: (tag?: Tag) => void
      title?: string
    }
  | {
      mode: 'select'
      entity: (typeof entitiesArray)[number]
      id?: string
      ids?: VerseIds
      title?: string
    }
  | false

export const unifiedTagsModalAtom = atom<UnifiedTagsModalProps>(false)

export const changelogModalAtom = atom(false)

export type ColorPickerModalProps =
  | {
      selectedColor?: string
      onSelectColor?: (colorId: string) => void // If present = selection mode
    }
  | false

export const colorPickerModalAtom = atom<ColorPickerModalProps>(false)

export type ColorChangeModalProps =
  | {
      selectedColor?: string
      onSelectColor: (colorId: string) => void
    }
  | false

export const colorChangeModalAtom = atom<ColorChangeModalProps>(false)

// Atom to trigger animation state reset in AppSwitcherProvider
export const resetTabAnimationTriggerAtom = atom(0)

// Signal atom — incremented after Bible migration completes,
// so that all mounted BibleViewer instances reload verses from SQLite.
export const bibleDataRefreshSignalAtom = atom(0)

// Signal atom — incremented to force the shared Android WebView to remount
// after first-run resource installation.
export const bibleDomRemountSignalAtom = atom(0)

export type { HistoryItem } from '~features/history/historyModel'

export const historyBaseAtom = atomWithAsyncStorage<HistoryItem[]>('history', [], {
  migrate: migrateHistoryItems,
})

export const historyAtom = atom(
  get => get(historyBaseAtom),
  (get, set, newItem: HistoryItemInput) => {
    const history = get(historyBaseAtom)
    set(historyBaseAtom, addHistoryItem(history, newItem))
  }
)

export const deleteHistoryAtom = atom(null, (_get, set) => {
  set(historyBaseAtom, [])
})

export const resetUserAtomsAtom = atom(null, (get, set) => {
  // Reset to a single default group with one Bible tab
  set(tabGroupsAtom, [createDefaultGroup()])
  set(activeGroupIdAtom, DEFAULT_GROUP_ID)
  set(cachedTabIdsAtom, [])
  set(historyBaseAtom, [])

  // Reset app switcher mode to view (first tab expanded)
  set(appSwitcherModeAtom, 'view')

  // Trigger animation reset in AppSwitcherProvider
  set(resetTabAnimationTriggerAtom, get(resetTabAnimationTriggerAtom) + 1)
})
