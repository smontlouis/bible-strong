import { useEffect, type RefObject } from 'react'
import { useAtom } from 'jotai'
import { assistantOpenRequestAtom } from './assistantSheetContext'

/**
 * Opens the sheet for a pending request, then clears it. The atom outlives the launcher (an
 * Android back press unmounts the tree but keeps the JavaScript alive), so a request left in
 * it would open the sheet again on every remount.
 */
export function useAssistantOpenRequest(sheet: RefObject<{ present: () => void } | null>) {
  const [request, setRequest] = useAtom(assistantOpenRequestAtom)
  useEffect(() => {
    if (!request) return
    sheet.current?.present()
    setRequest(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])
}
