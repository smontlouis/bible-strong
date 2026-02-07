import { createBibleResourceHelpers } from './bibleResource'

const helpers = createBibleResourceHelpers({
  label: 'Pericope',
  getFileName: (versionId) => `bible-${versionId.toLowerCase()}-pericope.json`,
  getCdnPath: (versionId) => `bibles/bible-${versionId.toLowerCase()}-pericope.json`,
  versionHasFeature: (version) => !!version.hasPericope,
})

export const requirePericopePath = helpers.getFilePath
export const getPericopeUrl = helpers.getFileUrl
export const versionHasPericope = helpers.versionSupported
export const hasPericopeFile = helpers.hasFile
export const downloadPericopeFile = helpers.downloadFile
export const deletePericopeFile = helpers.deleteFile
