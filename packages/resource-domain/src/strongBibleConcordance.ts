export const getStrongBibleConcordanceCandidates = (
  book: number,
  reference: string | number
): { kind: number; code: string }[] => {
  const raw = String(reference).trim().toUpperCase()
  const prefixed = /^[HG]/u.test(raw) ? raw : `${book <= 39 ? 'H' : 'G'}${raw}`
  const match = prefixed.match(/^([HG])0*(\d+)([A-Z]*)$/u)
  if (!match) return []
  const normalized = `${match[1]}${match[2].padStart(4, '0')}${match[3]}`
  const codes = [...new Set([prefixed, normalized])]
  const kinds = match[3] ? [2, 1] : [0]
  return kinds.flatMap(kind => codes.map(code => ({ kind, code })))
}
