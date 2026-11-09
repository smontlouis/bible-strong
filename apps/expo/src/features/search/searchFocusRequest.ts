import { atom } from 'jotai'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, type RefObject } from 'react'
import { Platform } from 'react-native'

/**
 * A request, with the time it was made, to put the cursor in the search field: the desktop app's
 * ⌘F opens the search tab, which may not exist yet. A request older than a moment is stale,
 * so a search tab opened later for another reason does not take the focus.
 */
export const searchFocusRequestAtom = atom<number | null>(null)

export const SEARCH_FOCUS_REQUEST_TTL_MS = 2000

/** Puts the cursor in `field` when asked, once the tab that holds it shows. */
export const useSearchFocusRequest = (field: RefObject<unknown>) => {
  const request = useAtomValue(searchFocusRequestAtom)
  const setRequest = useSetAtom(searchFocusRequestAtom)

  useEffect(() => {
    if (Platform.OS !== 'web' || request === null) return
    const deadline = request + SEARCH_FOCUS_REQUEST_TTL_MS
    let frame = 0
    const attempt = () => {
      if (Date.now() > deadline) return
      const element = field.current as HTMLElement | null
      // A tab kept in the background is hidden, and its field takes no focus.
      if (element && element.offsetParent !== null) {
        element.focus()
        setRequest(null)
        return
      }
      frame = requestAnimationFrame(attempt)
    }
    attempt()
    return () => cancelAnimationFrame(frame)
  }, [request, setRequest, field])
}
