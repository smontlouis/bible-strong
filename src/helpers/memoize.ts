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
      (cacheKey += `_${
        typeof arg === 'object' ? JSON.stringify(args) : `${arg}`
      }_`),
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

export default memoize
