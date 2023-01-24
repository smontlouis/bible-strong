import { VerseIds } from '~common/types'

export default (selectedVerses: VerseIds) => {
  const orderedVersesArray = Object.keys(selectedVerses).sort((key1, key2) => {
    const verse1 = Number(key1.split('-')[2])
    const verse2 = Number(key2.split('-')[2])
    return verse1 - verse2
  })
  const orderedVersesObject: VerseIds = {}
  orderedVersesArray.map(verse => {
    orderedVersesObject[verse] = true
  })
  return orderedVersesObject
}
