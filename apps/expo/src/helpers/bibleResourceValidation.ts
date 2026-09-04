const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const validateCanonicalBibleResourceIdentity = <
  Value extends { applicationVersionId: string },
>(
  versionId: string,
  value: Value
): void => {
  if (value.applicationVersionId !== versionId) {
    throw new Error('CANONICAL_BIBLE_METADATA_MISMATCH')
  }
}

export const validatePericopeResource = (value: unknown): void => {
  const valid =
    isRecord(value) &&
    Object.values(value).every(
      book =>
        isRecord(book) &&
        Object.values(book).every(
          chapter =>
            isRecord(chapter) &&
            Object.values(chapter).every(
              verse =>
                isRecord(verse) &&
                Object.values(verse).every(heading => typeof heading === 'string')
            )
        )
    )

  if (!valid) throw new Error('BIBLE_PERICOPE_SCHEMA_MISMATCH')
}

export const validateRedWordsResource = (value: unknown): void => {
  const valid =
    isRecord(value) &&
    Object.values(value).every(
      ranges =>
        Array.isArray(ranges) &&
        ranges.every(
          range =>
            isRecord(range) &&
            Number.isInteger(range.start) &&
            Number.isInteger(range.end) &&
            // Legacy publications use this empty range for verses without words.
            ((Number(range.start) === 0 && Number(range.end) === -1) ||
              (Number(range.start) >= 0 && Number(range.end) >= Number(range.start)))
        )
    )

  if (!valid) throw new Error('BIBLE_RED_WORDS_SCHEMA_MISMATCH')
}
