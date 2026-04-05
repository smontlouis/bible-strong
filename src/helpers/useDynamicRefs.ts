const map = new Map<string, any>()

const setRef =
  <T>(key: string) =>
  (ref: T | null) => {
    if (!key) throw new Error(`useDynamicRefs: Cannot set ref without key `)
    if (ref === null) {
      map.delete(key)
      return
    }
    map.set(key, ref)
  }

function getRef<T>(key: string): T | undefined {
  if (!key) throw new Error(`useDynamicRefs: Cannot get ref without key`)
  return map.get(key) as T | undefined
}

function useDynamicRefs<T>(): [
  (key: string) => T | undefined,
  (key: string) => (ref: T | null) => void,
] {
  return [getRef, setRef]
}

export default useDynamicRefs
