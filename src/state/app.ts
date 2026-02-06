import produce from 'immer'
import { atom } from 'jotai/vanilla'
import { Tag, VerseIds } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
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
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export const isFullScreenBibleAtom = atom(false)

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

export type TagDetailModalProps = { tagId: string } | false

export const tagDetailModalAtom = atom<TagDetailModalProps>(false)

// Atom to trigger animation state reset in AppSwitcherProvider
export const resetTabAnimationTriggerAtom = atom(0)

export const resetUserAtomsAtom = atom(null, (get, set) => {
  // Reset to a single default group with one Bible tab
  set(tabGroupsAtom, [createDefaultGroup()])
  set(activeGroupIdAtom, DEFAULT_GROUP_ID)
  set(cachedTabIdsAtom, [])

  // Reset app switcher mode to view (first tab expanded)
  set(appSwitcherModeAtom, 'view')

  // Trigger animation reset in AppSwitcherProvider
  set(resetTabAnimationTriggerAtom, get(resetTabAnimationTriggerAtom) + 1)
})

type BaseHistoryItem = {
  date: number
}
export type HistoryStrongItem = BaseHistoryItem & {
  type: 'strong'
  Hebreu: string
  Grec: string
  Mot: string
  book: number
}

export type HistoryVerseItem = BaseHistoryItem & {
  type: 'verse'
  book: string | number
  chapter: string | number
  verse: string | number
  version: string
}

export type HistoryWordItem = BaseHistoryItem & {
  type: 'word'
  word: string
}

export type HistoryNaveItem = BaseHistoryItem & {
  type: 'nave'
  name: string
  name_lower: string
}

export type HistoryItem = HistoryStrongItem | HistoryVerseItem | HistoryWordItem | HistoryNaveItem

export const checkHistoryItemType = <Type extends HistoryItem>(
  item: HistoryItem | undefined,
  type: HistoryItem['type']
): item is Type => {
  return item?.type === type
}

export const historyBaseAtom = atomWithAsyncStorage<HistoryItem[]>('history', [])

export const historyAtom = atom(
  get => get(historyBaseAtom),
  (get, set, newItem: HistoryItem) => {
    const history = get(historyBaseAtom)

    const prevItem = history[0]

    if (prevItem) {
      if (prevItem.type === newItem.type) {
        if (
          checkHistoryItemType<HistoryVerseItem>(prevItem, 'verse') &&
          checkHistoryItemType<HistoryVerseItem>(newItem, 'verse')
        ) {
          if (
            prevItem.book === newItem.book &&
            prevItem.chapter === newItem.chapter &&
            prevItem.verse === newItem.verse
          ) {
            return
          }
        }

        if (
          checkHistoryItemType<HistoryStrongItem>(prevItem, 'strong') &&
          checkHistoryItemType<HistoryStrongItem>(newItem, 'strong')
        ) {
          if (prevItem.Mot === newItem.Mot) {
            return
          }
        }

        if (
          checkHistoryItemType<HistoryWordItem>(prevItem, 'word') &&
          checkHistoryItemType<HistoryWordItem>(newItem, 'word')
        ) {
          if (prevItem.word === newItem.word) {
            return
          }
        }

        if (
          checkHistoryItemType<HistoryNaveItem>(prevItem, 'nave') &&
          checkHistoryItemType<HistoryNaveItem>(newItem, 'nave')
        ) {
          if (prevItem.name === newItem.name) {
            return
          }
        }
      }
    }

    set(
      historyBaseAtom,
      produce(history, draft => {
        draft.unshift(newItem)
        draft.slice(0, 50)
      })
    )
  }
)

export const deleteHistoryAtom = atom(null, (get, set) => {
  set(historyBaseAtom, [])
})
