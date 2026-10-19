import { useState } from 'react'

/** The same array for as long as its items stay the same, so memoized selectors keep their result. */
export const useStableList = <T>(list: readonly T[]): readonly T[] => {
  const [stableList, setStableList] = useState(list)
  const changed =
    stableList.length !== list.length || stableList.some((item, index) => item !== list[index])
  if (changed) setStableList(list)
  return changed ? list : stableList
}

/** The same value for as long as its key stays the same, so it is not sent to the reader again. */
export const useStableValue = <T>(value: T, key: string): T => {
  const [stable, setStable] = useState({ key, value })
  if (stable.key !== key) setStable({ key, value })
  return stable.key === key ? stable.value : value
}
