import * as FileSystem from 'expo-file-system'

let loadedIndex = null

const loadIndexCache = idxFile =>
  new Promise(async resolve => {
    if (loadedIndex) {
      return resolve(loadedIndex)
    }

    const data = await FileSystem.readAsStringAsync(idxFile.uri)

    const lunr = require('lunr')
    require('lunr-languages/lunr.stemmer.support')(lunr)
    require('lunr-languages/lunr.fr')(lunr)
    require('~helpers/lunr.unicodeNormalizer')(lunr)

    loadedIndex = lunr.Index.load(JSON.parse(data))
    resolve(loadedIndex)
  })

export default loadIndexCache
