import { createBibleResourceHelpers } from './bibleResource'
import { validateRedWordsResource } from './bibleResourceValidation'

const helpers = createBibleResourceHelpers({
  label: 'RedWords',
  identityKind: 'bible-red-words',
  getFileName: versionId => `red-words-${versionId}.json`,
  getCdnPath: versionId => `bibles/red-words-${versionId.toLowerCase()}.json`,
  versionHasFeature: version => !!version.hasRedWords,
  validate: validateRedWordsResource,
})

export const requireRedWordsPath = helpers.getFilePath
export const getRedWordsUrl = helpers.getFileUrl
export const versionHasRedWords = helpers.versionSupported
export const hasRedWordsFile = helpers.hasFile
export const downloadRedWordsFile = helpers.downloadFile
export const deleteRedWordsFile = helpers.deleteFile
