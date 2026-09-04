import { isDate, isEmpty, isObject, properObject } from '../utils'

const updatedDiff = (lhs: unknown, rhs: unknown): unknown => {
  if (lhs === rhs) return {}

  if (!isObject(lhs) || !isObject(rhs)) return rhs

  const l = properObject(lhs)
  const r = properObject(rhs)

  if (isDate(l) || isDate(r)) {
    if (
      // eslint-disable-next-line eqeqeq
      l.valueOf() == r.valueOf()
    )
      return {}
    return r
  }

  return Object.keys(r).reduce<Record<string, unknown>>((acc, key) => {
    if (l.hasOwnProperty(key)) {
      const difference = updatedDiff(l[key], r[key])

      if (isObject(difference) && isEmpty(difference) && !isDate(difference)) return acc

      return { ...acc, [key]: difference }
    }

    return acc
  }, {})
}

export default updatedDiff
