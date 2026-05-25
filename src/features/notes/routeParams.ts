export const serializeNoteVerseKeys = (verseKeys: string[]): string => JSON.stringify(verseKeys)

export const parseNoteVerseKeysParam = (
  verseKeysParam: string | string[] | undefined
): string[] => {
  const serialized = Array.isArray(verseKeysParam) ? verseKeysParam[0] : verseKeysParam
  if (!serialized) return []

  try {
    const parsed = JSON.parse(serialized)
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : []
  } catch {
    return []
  }
}
