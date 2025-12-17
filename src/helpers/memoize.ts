import { getResourceLanguage, type ResourcesLanguageState } from 'src/state/resourcesLanguage'

/**
 * createCacheKeyFromArgs
 *
 * @desc Creates a cache key from fn's arguments.
 *
 * @param {any[]} args Arguments from fn being memoized.
 * @return {string} Returns a cache key.
 */
export const createCacheKeyFromArgs = (args: any[]) =>
  args.reduce(
    (cacheKey, arg) =>
      (cacheKey += `_${typeof arg === 'object' ? JSON.stringify(args) : `${arg}`}_`),
    ''
  )

/**
 * memoize
 *
 * @desc Creates a function that memoizes the result of fn.
 * The arguments of the fn are used to create a cache key.
 *
 * @param {Function} fn The function to have its output memoized.
 * @return {Function} Returns the new memoized function.
 */
const memoize = <ARGS extends unknown[], RET>(fn: (...args: ARGS) => RET) => {
  const cache: Record<string, RET> = {}

  return (...args: ARGS) => {
    const cacheKey = createCacheKeyFromArgs(args)

    if (cache[cacheKey]) {
      return cache[cacheKey]
    }

    const asyncFn = fn.call(undefined, ...args)
    cache[cacheKey] = asyncFn
    return asyncFn
  }
}

/**
 * memoizeWithLang
 *
 * @desc Creates a function that memoizes the result of fn with language awareness.
 * The cache key includes the current resource language from Redux state.
 *
 * @param {string} dbId The database ID to get the language for (e.g., 'STRONG', 'DICTIONNAIRE', 'NAVE')
 * @param {Function} fn The function to have its output memoized.
 * @return {Function} Returns the new memoized function.
 */
export const memoizeWithLang = <ARGS extends unknown[], RET>(
  dbId: keyof ResourcesLanguageState,
  fn: (...args: ARGS) => RET
) => {
  const cache: Record<string, RET> = {}

  return (...args: ARGS) => {
    const lang = getResourceLanguage(dbId)
    const cacheKey = `${lang}_${createCacheKeyFromArgs(args)}`

    if (cache[cacheKey]) {
      return cache[cacheKey]
    }

    const asyncFn = fn.call(undefined, ...args)
    cache[cacheKey] = asyncFn
    return asyncFn
  }
}

export default memoize
