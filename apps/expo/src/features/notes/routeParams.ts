export const serializeNoteVerseKeys = (verseKeys: string[]): string => JSON.stringify(verseKeys)

/** The page of a Note, or of a new Note on the verses given. */
export const getNoteRoute = ({
  noteId,
  verseKeys,
  version,
}: { noteId?: string | null; verseKeys?: string[]; version?: string } = {}) => ({
  pathname: '/note' as const,
  params: {
    ...(noteId ? { noteId } : {}),
    ...(verseKeys?.length ? { verseKeys: serializeNoteVerseKeys(verseKeys) } : {}),
    ...(version ? { version } : {}),
  },
})

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
