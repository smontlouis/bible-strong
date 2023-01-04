import { atom } from 'jotai'

export interface Diff {
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export const IAPInitializedAtom = atom(false)
export const fullscreenAtom = atom(false)
export const quotaModalAtom = atom(false)

type MultipleTagsModalProps =
  | { ids: { [verse: string]: true }; entity: string; title?: string }
  | { id: string; entity: string; title?: string }
  | false

export const multipleTagsModalAtom = atom<MultipleTagsModalProps>(false)
