
export default (selectedVerses) => {
  let orderedVersesArray = Object.keys(selectedVerses).sort((key1, key2) => {
    const verse1 = key1.split('-')[2]
    const verse2 = key2.split('-')[2]
    return verse2 < verse1
  })
  let orderedVersesObject = {}
  orderedVersesArray.map(verse => { orderedVersesObject[verse] = true })
  return orderedVersesObject
}
