import { isEmpty, isObject, properObject } from '../utils'

const addedDiff = (lhs: unknown, rhs: unknown): Record<string, unknown> => {
  if (lhs === rhs || !isObject(lhs) || !isObject(rhs)) return {}

  const l = properObject(lhs)
  const r = properObject(rhs)

  return Object.keys(r).reduce<Record<string, unknown>>((acc, key) => {
    if (l.hasOwnProperty(key)) {
      const difference = addedDiff(l[key], r[key])

      if (isObject(difference) && isEmpty(difference)) return acc

      return { ...acc, [key]: difference }
    }

    return { ...acc, [key]: r[key] }
  }, {})
}

export default addedDiff
