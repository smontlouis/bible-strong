import { useEffect, useId } from 'react'
import { useSetAtom } from 'jotai'
import { useIsFocused, usePathname } from 'expo-router'
import { resourceContextsAtom } from './readingContextRegistry'
import type { ReadingContext } from './conversations'
export function useAssistantResourceContext(scope: string, context: ReadingContext | null) {
  const id = useId(),
    path = usePathname(),
    focused = useIsFocused(),
    set = useSetAtom(resourceContextsAtom)
  const serialized = JSON.stringify(context)
  useEffect(() => {
    if (scope === 'panel' && !focused) return
    const value: ReadingContext | null = JSON.parse(serialized)
    if (!value) return
    set(previous => ({ ...previous, [id]: { scope, path, context: value } }))
    return () =>
      set(previous => {
        const next = { ...previous }
        delete next[id]
        return next
      })
  }, [id, path, scope, serialized, focused, set])
}
