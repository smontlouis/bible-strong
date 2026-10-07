/**
 * The identities a concordance reference may name, in the order they are tried.
 *
 * The letter case of a sense suffix is part of the identity: `H2148v` and `H2148V` are two
 * different men. A reference is tried as it is written first; its upper-cased spelling only
 * follows, for a reference written loosely (`h1254a`).
 */
export const getStrongBibleConcordanceCandidates = (
  book: number,
  reference: string | number
): { kind: number; code: string }[] => {
  const match = String(reference)
    .trim()
    .match(/^([HGhg]?)(0*(\d+))([A-Za-z]*)$/u)
  if (!match) return []
  const [, writtenPrefix, writtenNumber, number, writtenSuffix] = match
  const prefix = writtenPrefix ? writtenPrefix.toUpperCase() : book <= 39 ? 'H' : 'G'
  const suffixes = [...new Set([writtenSuffix, writtenSuffix.toUpperCase()])]
  const codes = suffixes.flatMap(suffix => [
    ...new Set([
      `${prefix}${writtenNumber}${suffix}`,
      `${prefix}${number.padStart(4, '0')}${suffix}`,
      `${prefix}${Number(number)}${suffix}`,
    ]),
  ])
  const kinds = writtenSuffix ? [2, 1] : [0]
  return kinds.flatMap(kind => codes.map(code => ({ kind, code })))
}
