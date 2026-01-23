import * as FileSystem from 'expo-file-system/legacy'
import type { ResourceLanguage } from '~helpers/databaseTypes'

// Initialize lunr plugins once at module load
// This ensures French stemmer is always available regardless of which language is loaded first
const lunr = require('lunr')
require('~helpers/lunr.stemmer.support.min.js')(lunr)
require('~helpers/lunr.fr.min.js')(lunr)
require('~helpers/lunr.unicodeNormalizer')(lunr)

// Cache per language
const loadedIndexes: { [lang: string]: object } = {}

const loadIndexCache = (idxFile: FileSystem.FileInfo, lang: ResourceLanguage = 'fr') =>
  new Promise(async resolve => {
    // Return cached index for this language if available
    if (loadedIndexes[lang]) {
      return resolve(loadedIndexes[lang])
    }

    // Read from the file passed (which should be language-specific)
    const data = await FileSystem.readAsStringAsync(idxFile.uri || '')

    loadedIndexes[lang] = lunr.Index.load(JSON.parse(data))
    resolve(loadedIndexes[lang])
  })

// Clear cache for a specific language
export const clearIndexCache = (lang: ResourceLanguage) => {
  delete loadedIndexes[lang]
}

// Clear all cached indexes
export const clearAllIndexCaches = () => {
  for (const key of Object.keys(loadedIndexes)) {
    delete loadedIndexes[key]
  }
}

export default loadIndexCache
