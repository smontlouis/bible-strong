// expo-sqlite chains the native cause into the message ("… has been rejected. → Caused by: …"),
// and some rejections also carry it as `cause`: both are read.
const errorText = (error: unknown, depth = 0): string => {
  const message = error instanceof Error ? error.message : String(error)
  const cause = (error as { cause?: unknown } | undefined)?.cause
  return cause && depth < 3 ? `${message}\n${errorText(cause, depth + 1)}` : message
}

const malformedPattern =
  /database disk image is malformed|file is not a database|SQLITE_CORRUPT|SQLITE_NOTADB/i

/** SQLite cannot read the file, or one of its tables: only rebuilding or replacing it helps. */
export const isMalformedDatabaseError = (error: unknown): boolean =>
  malformedPattern.test(errorText(error))

/**
 * A native handle released under the call: a closed connection ("already released"), or, on
 * Android, a database or statement object the native registry no longer finds ("doesn't contain
 * valid id"). The same call on a fresh connection works. Only these wordings are matched: every
 * native rejection starts with "Call to function 'NativeDatabase.*'", so matching that prefix
 * would also retry real errors such as "no such table".
 */
export const isReleasedHandleError = (error: unknown): boolean => {
  const text = errorText(error)
  return text.includes('already released') || text.includes("doesn't contain valid id")
}
