import { atom } from 'jotai'
import type { ConfirmDialogOptions } from './types'
export type ConfirmRequest = {
  options: ConfirmDialogOptions
  resolve: (confirmed: boolean) => void
}
export const confirmRequestsAtom = atom<ConfirmRequest[]>([])
