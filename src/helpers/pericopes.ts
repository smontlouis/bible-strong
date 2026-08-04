import { createBibleResourceHelpers } from './bibleResource'
import { validatePericopeResource } from './bibleResourceValidation'

const helpers = createBibleResourceHelpers({
  label: 'Pericope',
  identityKind: 'bible-pericope',
  getFileName: versionId => `bible-${versionId.toLowerCase()}-pericope.json`,
  getCdnPath: versionId => `bibles/bible-${versionId.toLowerCase()}-pericope.json`,
  versionHasFeature: version => !!version.hasPericope,
  validate: validatePericopeResource,
})

export const requirePericopePath = helpers.getFilePath
export const getPericopeUrl = helpers.getFileUrl
export const versionHasPericope = helpers.versionSupported
export const hasPericopeFile = helpers.hasFile
export const downloadPericopeFile = helpers.downloadFile
export const deletePericopeFile = helpers.deleteFile
