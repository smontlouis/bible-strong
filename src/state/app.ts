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
