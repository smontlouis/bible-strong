import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const tipsAtom = atomWithAsyncStorage<string[]>('tips', [])

export const dismissTipAtom = atom(false, (get, set, tipId: string) => {
  set(tipsAtom, [...get(tipsAtom), tipId])
})

export const useTip = (tipId: string) => {
  const tips = useAtomValue(tipsAtom)
  const isDismissed = tips.includes(tipId)
  return isDismissed
}
