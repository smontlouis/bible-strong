import * as React from 'react'

const map = new Map<string, any>()

const setRef = <T>(key: string) => (ref: T) => {
  if (!key) throw new Error(`useDynamicRefs: Cannot set ref without key `)
  map.set(key, ref)
}

function getRef<T>(key: string): React.RefObject<T> | undefined {
  if (!key) throw new Error(`useDynamicRefs: Cannot get ref without key`)
  return { current: map.get(key) } as React.RefObject<T>
}

function useDynamicRefs<T>(): [
  (key: string) => React.RefObject<T> | undefined,
  (key: string) => (ref: T) => void
] {
  return [getRef, setRef]
}

export default useDynamicRefs
