import { isObject } from './utils'

const getLargerArray = (l: unknown[], r: unknown[]): unknown[] => (l.length > r.length ? l : r)

const preserve = (
  diff: unknown,
  left: Record<string, unknown>,
  right: Record<string, unknown>
): unknown => {
  if (!isObject(diff)) return diff

  return Object.keys(diff).reduce<Record<string, unknown>>((acc, key) => {
    const leftArray = left[key]
    const rightArray = right[key]

    if (Array.isArray(leftArray) && Array.isArray(rightArray)) {
      const array = [...getLargerArray(leftArray, rightArray)]
      return {
        ...acc,
        [key]: array.reduce<unknown[]>((acc2, item, index) => {
          if ((diff as Record<string, unknown[]>)[key].hasOwnProperty(index)) {
            acc2[index] = preserve(
              (diff as Record<string, unknown[]>)[key][index],
              leftArray[index] as Record<string, unknown>,
              rightArray[index] as Record<string, unknown>
            ) // diff recurse and check for nested arrays
            return acc2
          }

          delete acc2[index] // no diff aka empty
          return acc2
        }, array),
      }
    }

    return {
      ...acc,
      [key]: (diff as Record<string, unknown>)[key],
    }
  }, {})
}

export default preserve
