type BibleVerseImportData<T> = Record<string, Record<string, Record<string, T>>>

export const isImportableBibleVerse = <T>(
  verseKey: string,
  verseData: T
): verseData is T & (string | { text: string }) =>
  /^\d+$/.test(verseKey) &&
  (typeof verseData === 'string' ||
    (typeof verseData === 'object' &&
      verseData !== null &&
      'text' in verseData &&
      typeof verseData.text === 'string'))

export function* getImportableBibleVerses<T>(verses: BibleVerseImportData<T>) {
  for (const [bookKey, book] of Object.entries(verses)) {
    const bookNumber = Number(bookKey)
    if (Number.isNaN(bookNumber)) continue
    for (const [chapterKey, chapter] of Object.entries(book)) {
      const chapterNumber = Number(chapterKey)
      if (Number.isNaN(chapterNumber)) continue
      for (const [verseKey, verseData] of Object.entries(chapter)) {
        if (!isImportableBibleVerse(verseKey, verseData)) continue
        yield {
          bookNumber,
          chapterNumber,
          verseNumber: Number(verseKey),
          verseData,
        }
      }
    }
  }
}

export const countImportableBibleVerses = <T>(verses: BibleVerseImportData<T>): number => {
  let count = 0
  const iterator = getImportableBibleVerses(verses)
  while (!iterator.next().done) count += 1
  return count
}
