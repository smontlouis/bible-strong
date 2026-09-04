import { isDate, isEmpty, isObject, properObject } from '../utils'

const diff = (lhs: unknown, rhs: unknown, deletedValue?: unknown): unknown => {
  if (lhs === rhs) return {} // equal return no diff

  if (!isObject(lhs) || !isObject(rhs)) return rhs // return updated rhs

  const l = properObject(lhs)
  const r = properObject(rhs)

  const deletedValues = Object.keys(l).reduce<Record<string, unknown>>((acc, key) => {
    return r.hasOwnProperty(key) ? acc : { ...acc, [key]: deletedValue || undefined }
  }, {})

  if (isDate(l) || isDate(r)) {
    if (
      // eslint-disable-next-line eqeqeq
      l.valueOf() == r.valueOf()
    )
      return {}
    return r
  }

  return Object.keys(r).reduce<Record<string, unknown>>((acc, key) => {
    if (!l.hasOwnProperty(key)) return { ...acc, [key]: r[key] } // return added r key

    const difference = diff(l[key], r[key], deletedValue)

    if (isObject(difference) && isEmpty(difference) && !isDate(difference)) return acc // return no diff

    return { ...acc, [key]: difference } // return updated key
  }, deletedValues)
}

export default diff
