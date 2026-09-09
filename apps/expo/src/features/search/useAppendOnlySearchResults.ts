import { useState } from 'react'

export function appendSearchResultKeys(previous: readonly string[], incoming: readonly string[]) {
  return Array.from(new Set([...previous, ...incoming]))
}

/** Keep visible rows in place as independently paginated sources arrive. */
export function useAppendOnlySearchResults<T>(
  scope: string,
  items: readonly T[],
  keyOf: (item: T) => string
): T[] {
  const [order, setOrder] = useState<{ scope: string; keys: string[] }>({ scope, keys: [] })
  const keys = appendSearchResultKeys(order.scope === scope ? order.keys : [], items.map(keyOf))
  if (order.scope !== scope || keys.length !== order.keys.length) setOrder({ scope, keys })
  const byKey = new Map<string, T>()
  for (const item of items) if (!byKey.has(keyOf(item))) byKey.set(keyOf(item), item)
  return keys.flatMap(key => {
    const item = byKey.get(key)
    return item === undefined ? [] : [item]
  })
}

export const passageResultKey = (item: {
  version: string
  book: number
  chapter: number
  verse: number
}) => `${item.version}:${item.book}:${item.chapter}:${item.verse}`
