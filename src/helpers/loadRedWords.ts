import { createBibleResourceLoader } from './loadBibleResource'
import { requireRedWordsPath, versionHasRedWords } from './redWords'

type RedWordsRange = { start: number; end: number }
type RedWordsData = Record<string, RedWordsRange[]>

const redWordsLoader = createBibleResourceLoader<RedWordsData>({
  versionSupported: versionHasRedWords,
  getFilePath: requireRedWordsPath,
})

export const loadRedWords = redWordsLoader.load
export const clearRedWordsCache = redWordsLoader.clearCache
