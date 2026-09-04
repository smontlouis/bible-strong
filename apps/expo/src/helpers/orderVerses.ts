import { VerseIds } from '~common/types'

export default (selectedVerses: VerseIds) => {
  const orderedVersesArray = Object.keys(selectedVerses).sort((key1, key2) => {
    const [book1, chapter1, verse1] = key1.split('-').map(Number)
    const [book2, chapter2, verse2] = key2.split('-').map(Number)
    return book1 - book2 || chapter1 - chapter2 || verse1 - verse2
  })
  const orderedVersesObject: VerseIds = {}
  orderedVersesArray.map(verse => {
    orderedVersesObject[verse] = true
  })
  return orderedVersesObject
}
