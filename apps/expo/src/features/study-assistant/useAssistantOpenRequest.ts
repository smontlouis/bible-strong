import { useEffect, useEffectEvent, type RefObject } from 'react'
import { useAtom } from 'jotai'
import { assistantOpenRequestAtom } from './assistantSheetContext'

/**
 * Opens the sheet for a pending request, then clears it. The atom outlives the launcher (an
 * Android back press unmounts the tree but keeps the JavaScript alive), so a request left in
 * it would open the sheet again on every remount.
 */
export function useAssistantOpenRequest(sheet: RefObject<{ present: () => void } | null>) {
  const [request, setRequest] = useAtom(assistantOpenRequestAtom)
  const present = useEffectEvent(() => {
    sheet.current?.present()
    setRequest(0)
  })
  useEffect(() => {
    if (!request) return
    present()
  }, [request])
}
