import { useSetAtom } from 'jotai/react'
import { useEffect, useEffectEvent } from 'react'
import { historyAtom } from '~state/app'
import { getHistoryItemKey, type HistoryItemInput } from './historyModel'

type HistoryEntryInput = HistoryItemInput extends infer T
  ? T extends HistoryItemInput
    ? Omit<T, 'date'>
    : never
  : never

/**
 * Records the entity on screen once it is loaded. Passing `null` records nothing (still loading,
 * a list, a draft…); a new entity is recorded when its identity changes.
 */
export const useRecordHistory = (entry: HistoryEntryInput | null | undefined) => {
  const addHistory = useSetAtom(historyAtom)
  const key = entry ? getHistoryItemKey({ ...entry, date: 0 } as HistoryItemInput) : undefined
  const record = useEffectEvent(() => {
    if (entry) addHistory({ ...entry, date: Date.now() } as HistoryItemInput)
  })

  useEffect(() => {
    if (key) record()
  }, [key])
}
