/**
 * The distinct values of a list parameter in a fixed order: equal sets give equal addresses,
 * which the Resource API edge cache can then serve to every reader. Use it only where the
 * server treats the list as a set and the client matches the answer back by value.
 */
export const canonicalListParameter = (values: readonly string[]): string[] =>
  [...new Set(values)].sort()
