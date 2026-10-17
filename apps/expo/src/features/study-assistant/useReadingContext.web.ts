import { useEffect, useState } from 'react'
import { useWorkspaceRoutePanel } from '~navigation/useWorkspaceRoutePanel'
import { resourceContextsAtom } from './readingContextRegistry'
import { pickReadingContext } from './resourceContext'
import { resolveReadingContexts } from './readingContextSources'
import { atom, useAtomValue } from 'jotai'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import { activeTabIndexAtom, tabsAtomsAtom } from '~state/tabs'
import type { ReadingContext } from './conversations'
const currentTab = atom(get => {
  const tabs = get(tabsAtomsAtom),
    index = get(activeTabIndexAtom)
  return tabs[index] ? get(tabs[index]) : undefined
})
export function useReadingContext(): ReadingContext | null {
  const tab = useAtomValue(currentTab)
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const layout = useWorkspaceRoutePanel()
  const registry = useAtomValue(resourceContextsAtom)
  const location = JSON.stringify([pathname, params, tab?.id])
  const [interaction, setInteraction] = useState<{
    location: string
    surface: 'reader' | 'panel'
  } | null>(null)
  useEffect(() => {
    const track = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('.bs-assistant-modal, .bs-assistant-anchor')) return
      const surface = target
        ?.closest('[data-assistant-surface]')
        ?.getAttribute('data-assistant-surface')
      if (surface === 'reader' || surface === 'panel')
        setInteraction(previous =>
          previous?.location === location && previous.surface === surface
            ? previous
            : { location, surface }
        )
    }
    document.addEventListener('pointerdown', track, true)
    document.addEventListener('focusin', track, true)
    document.addEventListener('wheel', track, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', track, true)
      document.removeEventListener('focusin', track, true)
      document.removeEventListener('wheel', track, true)
    }
  }, [location])
  const { reader, panel } = resolveReadingContexts({ tab, pathname, params, registry })
  if (pathname === '/') return reader
  if (layout.showsStudy)
    return pickReadingContext({ panelOpen: true, reader, panel, interaction, location })
  return panel
}
