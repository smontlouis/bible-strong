import produce from 'immer'
import { atom } from 'jotai/vanilla'
import { VerseIds } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  activeTabIndexAtomOriginal,
  getDefaultBibleTab,
  tabsAtom,
} from './tabs'
import { makeMutable } from 'react-native-reanimated'

export interface Diff {
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export const isFullScreenBibleAtom = atom(false)
export const isFullScreenBibleValue = makeMutable(false)

export const IAPInitializedAtom = atom(false)

type MultipleTagsModalProps =
  | { ids: VerseIds; entity: string; title?: string }
  | { id: string; entity: string; title?: string }
  | false

export const multipleTagsModalAtom = atom<MultipleTagsModalProps>(false)

export const resetUserAtomsAtom = atom(null, (get, set) => {
  set(activeTabIndexAtomOriginal, 0)
  set(tabsAtom, [getDefaultBibleTab()])
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

export type HistoryItem =
  | HistoryStrongItem
  | HistoryVerseItem
  | HistoryWordItem
  | HistoryNaveItem

export const checkHistoryItemType = <Type extends HistoryItem>(
  item: HistoryItem | undefined,
  type: HistoryItem['type']
): item is Type => {
  return item?.type === type
}

export const historyBaseAtom = atomWithAsyncStorage<HistoryItem[]>(
  'history',
  []
)

export const historyAtom = atom(
  (get) => get(historyBaseAtom),
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
      produce(history, (draft) => {
        draft.unshift(newItem)
        draft.slice(0, 50)
      })
    )
  }
)

export const deleteHistoryAtom = atom(null, (get, set) => {
  set(historyBaseAtom, [])
})
