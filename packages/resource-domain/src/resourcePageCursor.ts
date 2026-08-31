export type DictionaryPageCursor = readonly [normalizedWord: string, id: number]
export type DictionaryDirectoryPageCursor = readonly [normalizedLabel: string, key: string]
export type NavePageCursor = readonly [name: string, normalizedName: string]
export type StrongLexiconPageCursor = { gloss: string; baseCode: number; id: number }

const parseCursor = (cursor?: string): unknown => {
  if (!cursor) return undefined
  try {
    return JSON.parse(decodeURIComponent(cursor))
  } catch {
    return undefined
  }
}

export const encodeDictionaryPageCursor = (cursor: DictionaryPageCursor) =>
  encodeURIComponent(JSON.stringify(cursor))

export const decodeDictionaryPageCursor = (cursor?: string): DictionaryPageCursor | undefined => {
  const value = parseCursor(cursor)
  return Array.isArray(value) && typeof value[0] === 'string' && Number.isInteger(value[1])
    ? [value[0], value[1] as number]
    : undefined
}

export const encodeDictionaryDirectoryPageCursor = (cursor: DictionaryDirectoryPageCursor) =>
  encodeURIComponent(JSON.stringify(cursor))

export const decodeDictionaryDirectoryPageCursor = (
  cursor?: string
): DictionaryDirectoryPageCursor | undefined => {
  const value = parseCursor(cursor)
  return Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'string'
    ? [value[0], value[1]]
    : undefined
}

export const encodeNavePageCursor = (cursor: NavePageCursor) =>
  encodeURIComponent(JSON.stringify(cursor))

export const decodeNavePageCursor = (cursor?: string): NavePageCursor | undefined => {
  const value = parseCursor(cursor)
  return Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'string'
    ? [value[0], value[1]]
    : undefined
}

export const encodeStrongLexiconPageCursor = (cursor: StrongLexiconPageCursor) =>
  encodeURIComponent(JSON.stringify(cursor))

export const decodeStrongLexiconPageCursor = (
  cursor?: string
): StrongLexiconPageCursor | undefined => {
  const value = parseCursor(cursor)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as Partial<StrongLexiconPageCursor>
  return typeof candidate.gloss === 'string' &&
    Number.isInteger(candidate.baseCode) &&
    Number.isInteger(candidate.id)
    ? {
        gloss: candidate.gloss,
        baseCode: candidate.baseCode as number,
        id: candidate.id as number,
      }
    : undefined
}
