const EXPLICIT_OPERATOR_REGEX = /\b(AND|OR|NOT)\b/

const normalizeFtsTokenBoundaries = (value: string) => value.replace(/[^\p{L}\p{N}\s"*]/gu, ' ')

export const buildNearFtsQuery = (raw: string, distance: number = 5): string | null => {
  const trimmed = raw.trim()

  if (EXPLICIT_OPERATOR_REGEX.test(trimmed) || trimmed.includes('"')) return null

  const tokens = normalizeFtsTokenBoundaries(trimmed).split(/\s+/).filter(Boolean)

  if (tokens.length < 2) return null

  return `NEAR(${tokens.join(' ')}, ${distance})`
}

export const sanitizeFtsQuery = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (EXPLICIT_OPERATOR_REGEX.test(trimmed) || trimmed.includes('"')) {
    return normalizeFtsTokenBoundaries(trimmed).replace(/\s+/g, ' ').trim()
  }

  const tokens = normalizeFtsTokenBoundaries(trimmed).split(/\s+/).filter(Boolean)

  return tokens.map(token => (token.endsWith('*') ? token : `${token}*`)).join(' ')
}
