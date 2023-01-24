import { atom } from 'jotai'
import { VerseIds } from '~common/types'
import {
  activeTabIndexAtomOriginal,
  getDefaultBibleTab,
  tabsAtom,
} from './tabs'

export interface Diff {
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export const IAPInitializedAtom = atom(false)
export const fullscreenAtom = atom(false)
export const quotaModalAtom = atom<'daily' | 'always' | null>(null)

type MultipleTagsModalProps =
  | { ids: VerseIds; entity: string; title?: string }
  | { id: string; entity: string; title?: string }
  | false

export const multipleTagsModalAtom = atom<MultipleTagsModalProps>(false)

export const resetUserAtomsAtom = atom(null, (get, set) => {
  set(activeTabIndexAtomOriginal, 0)
  set(tabsAtom, [getDefaultBibleTab()])
})
