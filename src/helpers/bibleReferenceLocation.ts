export const getBibleReferenceLocation = (verseKeys: string[]) => {
  const [bookNumber, chapter, verse] = verseKeys[0].split('-').map(Number)
  const focusVerses = verseKeys
    .filter(verseKey => {
      const [keyBook, keyChapter] = verseKey.split('-').map(Number)
      return keyBook === bookNumber && keyChapter === chapter
    })
    .map(verseKey => Number(verseKey.split('-')[2]))

  return { bookNumber, chapter, verse, focusVerses }
}
