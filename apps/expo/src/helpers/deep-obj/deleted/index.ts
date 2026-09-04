import { isEmpty, isObject, properObject } from '../utils'

const deletedDiff = (lhs: unknown, rhs: unknown, replace?: unknown): Record<string, unknown> => {
  if (lhs === rhs || !isObject(lhs) || !isObject(rhs)) return {}

  const l = properObject(lhs)
  const r = properObject(rhs)

  return Object.keys(l).reduce<Record<string, unknown>>((acc, key) => {
    if (r.hasOwnProperty(key)) {
      const difference = deletedDiff(l[key], r[key], replace)

      if (isObject(difference) && isEmpty(difference)) return acc

      return { ...acc, [key]: difference }
    }

    return { ...acc, [key]: replace || undefined }
  }, {})
}

export default deletedDiff
