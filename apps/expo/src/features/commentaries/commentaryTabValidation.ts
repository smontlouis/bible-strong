export const isValidCommentaryVerse = (verse: unknown): verse is string => {
  if (typeof verse !== 'string') return false
  const parts = verse.split('-').map(Number)
  return parts.length === 3 && parts.every(part => Number.isSafeInteger(part) && part > 0)
}
