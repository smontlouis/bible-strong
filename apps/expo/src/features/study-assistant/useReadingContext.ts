import { useEffect, useState } from 'react'
import { atom, useAtomValue } from 'jotai'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import { activeTabIndexAtom, tabsAtomsAtom } from '~state/tabs'
import { ASSISTANT_PATH } from './assistantSheetContext'
import type { ReadingContext } from './conversations'
import { resourceContextsAtom } from './readingContextRegistry'
import { resolveReadingContexts } from './readingContextSources'

const currentTab = atom(get => {
  const tabs = get(tabsAtomsAtom),
    index = get(activeTabIndexAtom)
  return tabs[index] ? get(tabs[index]) : undefined
})

/**
 * Native screens are stacked, never side by side: the workspace root follows the active
 * tab, and any route pushed over it is the surface the reader is looking at. The assistant is
 * a route too: while it is in front, the context stays the one of the screen it opened over.
 */
export function useReadingContext(): ReadingContext | null {
  const tab = useAtomValue(currentTab)
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const registry = useAtomValue(resourceContextsAtom)
  const { reader, panel } = resolveReadingContexts({ tab, pathname, params, registry })
  const live = pathname === '/' ? reader : panel
  const assistantInFront = pathname === ASSISTANT_PATH
  const [kept, setKept] = useState(live)
  const liveKey = JSON.stringify(live)
  useEffect(() => {
    if (!assistantInFront) setKept(live)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantInFront, liveKey])
  return assistantInFront ? kept : live
}
