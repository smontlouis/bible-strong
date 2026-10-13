import { atom, useAtomValue } from 'jotai'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import { activeTabIndexAtom, tabsAtomsAtom } from '~state/tabs'
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
 * tab, and any route pushed over it is the surface the reader is looking at.
 */
export function useReadingContext(): ReadingContext | null {
  const tab = useAtomValue(currentTab)
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const registry = useAtomValue(resourceContextsAtom)
  const { reader, panel } = resolveReadingContexts({ tab, pathname, params, registry })
  return pathname === '/' ? reader : panel
}
