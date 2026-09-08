import { useSetAtom } from 'jotai'
import { confirmRequestsAtom } from './state'
import type { ConfirmDialogOptions } from './types'

export function useConfirmDialog() {
  const setRequests = useSetAtom(confirmRequestsAtom)
  return (options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise(resolve => {
      setRequests(current => [...current, { options, resolve }])
    })
}
