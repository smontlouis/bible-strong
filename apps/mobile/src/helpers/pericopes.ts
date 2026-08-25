import { createBibleResourceHelpers } from './bibleResource'

const helpers = createBibleResourceHelpers({
  label: 'Pericope',
  identityKind: 'bible-pericope',
  getFileName: versionId => `bible-${versionId.toLowerCase()}-pericope.json`,
  versionHasFeature: version => !!version.hasPericope,
})

export const requirePericopePath = helpers.getFilePath
export const versionHasPericope = helpers.versionSupported
export const hasPericopeFile = helpers.hasFile
export const deletePericopeFile = helpers.deleteFile
