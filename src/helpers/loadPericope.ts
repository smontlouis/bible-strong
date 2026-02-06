import { Pericope } from '~common/types'
import { createBibleResourceLoader } from './loadBibleResource'
import { requirePericopePath, versionHasPericope } from './pericopes'

const pericopeLoader = createBibleResourceLoader<Pericope>({
  versionSupported: versionHasPericope,
  getFilePath: requirePericopePath,
})

export const loadPericope = pericopeLoader.load
export const clearPericopeCache = pericopeLoader.clearCache
