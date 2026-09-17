import { useEffect, useState } from 'react'
import { useWorkspaceRoutePanel } from '~navigation/useWorkspaceRoutePanel'
import { resourceContextsAtom } from './readingContextRegistry'
import {
  bibleContext,
  commentaryContext,
  commentaryCollectionContext,
  dictionaryContext,
  naveContext,
  pickReadingContext,
} from './resourceContext'
import { normalizeStrongRouteIdentity } from '~features/lexique/strongRouteIdentity'
import { atom, useAtomValue } from 'jotai'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import { activeTabIndexAtom, tabsAtomsAtom } from '~state/tabs'
import {
  parseStrongDetailRouteParams,
  type StrongDetailRouteContext,
} from '~features/lexique/strongDetailRoutes'
import verseToReference from '~helpers/verseToReference'
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
  const wordContext = (
    word?: string,
    reference?: string,
    version?: string,
    location?: string
  ): ReadingContext | null => {
    if (!word && !reference) return null
    const label = [word, reference].filter(Boolean).join(' · ')
    const detail = [label, location, version].filter(Boolean).join(' · ').slice(0, 500)
    return { key: detail, label: label.slice(0, 500), detail, kind: 'word' }
  }
  const fromWord = (data: StrongDetailRouteContext) => {
    let identity
    try {
      identity = normalizeStrongRouteIdentity(data)
    } catch {
      return null
    }
    return wordContext(
      data.clickedWord || data.strongReference?.Mot,
      identity?.code,
      data.bibleVersion,
      data.book && data.bibleChapter && data.bibleVerse
        ? verseToReference(`${data.book}-${data.bibleChapter}-${data.bibleVerse}`)
        : undefined
    )
  }
  const entries = Object.values(registry)
  const publishedReader = entries.find(e => e.scope === `tab:${tab?.id}`)?.context
  const reader =
    publishedReader ||
    (tab?.type === 'strong'
      ? fromWord(tab.data)
      : tab?.type === 'bible'
        ? bibleContext(tab)
        : tab?.type === 'dictionary'
          ? dictionaryContext(tab.data)
          : tab?.type === 'nave'
            ? naveContext(tab.data)
            : tab?.type === 'commentary'
              ? commentaryCollectionContext(tab.data.verse)
              : tab?.type === 'commentary-resource'
                ? commentaryContext(tab.data)
                : null)
  const scalar = (value: unknown) => (typeof value === 'string' ? value : undefined)
  let panel = entries.find(e => e.scope === 'panel' && e.path === pathname)?.context || null
  if (!panel && pathname.startsWith('/strong'))
    panel = fromWord(parseStrongDetailRouteParams(params).context)
  if (!panel && ['/commentary-entry', '/commentary-chapter'].includes(pathname))
    panel = commentaryContext({
      projectionId: scalar(params.projectionId),
      book: scalar(params.book),
      chapter: scalar(params.chapter),
      sectionId: scalar(params.sectionId),
    })
  if (pathname === '/') return reader
  if (layout.showsStudy)
    return pickReadingContext({ panelOpen: true, reader, panel, interaction, location })
  return panel
}
