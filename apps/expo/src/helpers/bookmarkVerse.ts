/** Older synced bookmarks can contain a non-scalar verse; still allow opening their chapter. */
export const getBookmarkVerse = (value: unknown): number | undefined => {
  const verse = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return typeof verse === 'number' && Number.isSafeInteger(verse) && verse > 0 ? verse : undefined
}
