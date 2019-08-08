const getBibleVerseText = (bible, book, chapter, verse) => {
  return bible[book] && bible[book][chapter] && bible[book][chapter][verse]
}

export default getBibleVerseText
