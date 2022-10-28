import { proxy } from 'valtio'
import { atom, PrimitiveAtom, useAtom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import AsyncStorage from '@react-native-community/async-storage'
import { useEffect } from 'react'

export interface Diff {
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export type ConflictEntity =
  | 'highlights'
  | 'tags'
  | 'words'
  | 'naves'
  | 'strongsHebreu'
  | 'strongsGrec'
  | 'notes'
  | 'studies'
  | 'plan'
  | 'settings'
  | 'photoURL'

export interface ConflictItem {
  content: string
  children?: ConflictItem[]
}

export interface ConflictParent extends ConflictItem {
  entity: ConflictEntity
}

interface Conflict {
  diff?: Diff
  onDispatchUserSuccess?: Function
  lastSeen?: number
  remoteLastSeen?: number
}

export type QuotaAtom = {
  remaining: number
  lastDate: number
}

export const conflictStateProxy: Conflict = proxy({
  diff: undefined,
  onDispatchUserSuccess: undefined,
  lastSeen: undefined,
  remoteLastSeen: undefined,
})

const defaultStorage = {
  ...createJSONStorage(() => AsyncStorage),
  // delayInit: true,
}

const atomWithAsyncStorage = <Value>(key: string, initialValue: Value) =>
  (atomWithStorage(
    key,
    initialValue,
    defaultStorage
  ) as unknown) as PrimitiveAtom<Value>

export const IAPInitializedAtom = atom(false)
export const fullscreenAtom = atom(false)
export const quotaModalAtom = atom(false)

export const bibleSearchQuotaAtom = atomWithAsyncStorage<QuotaAtom>(
  'bible-search-quota',
  {
    remaining: 10,
    lastDate: 0,
  }
)

export const timelineSearchQuotaAtom = atomWithAsyncStorage<QuotaAtom>(
  'timeline-search-quota',
  { remaining: 10, lastDate: 0 }
)

export const translateCommentsQuotaAtom = atomWithAsyncStorage<QuotaAtom>(
  'translate-comment-quota',
  { remaining: 10, lastDate: 0 }
)

export const quotaAtoms = {
  bibleSearch: bibleSearchQuotaAtom,
  timelineSearch: timelineSearchQuotaAtom,
  translateComments: translateCommentsQuotaAtom,
} as const

export type QuotaAtomType = keyof typeof quotaAtoms

export const resetQuotaAtoms = atom(null, (get, set) => {
  const now = Date.now()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayTimestamp = today.getTime()

  const bibleSearchQuota = get(bibleSearchQuotaAtom)
  const timelineSearchQuota = get(timelineSearchQuotaAtom)
  const translateCommentsQuota = get(translateCommentsQuotaAtom)

  console.log({ t: translateCommentsQuota.lastDate, todayTimestamp })

  if (bibleSearchQuota.lastDate < todayTimestamp) {
    set(bibleSearchQuotaAtom, {
      remaining: 10,
      lastDate: todayTimestamp,
    })
  }

  if (timelineSearchQuota.lastDate < todayTimestamp) {
    set(timelineSearchQuotaAtom, {
      remaining: 10,
      lastDate: todayTimestamp,
    })
  }

  if (translateCommentsQuota.lastDate < todayTimestamp) {
    set(translateCommentsQuotaAtom, {
      remaining: 10,
      lastDate: todayTimestamp,
    })
  }
})

export const useTriggerResetQuotaAtoms = () => {
  const [, reset] = useAtom(resetQuotaAtoms)

  useEffect(() => {
    reset()
  }, [reset])
}
