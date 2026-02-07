import { createBibleResourceHelpers } from './bibleResource'

const helpers = createBibleResourceHelpers({
  label: 'RedWords',
  getFileName: (versionId) => `red-words-${versionId}.json`,
  getCdnPath: (versionId) => `bibles/red-words-${versionId.toLowerCase()}.json`,
  versionHasFeature: (version) => !!version.hasRedWords,
})

export const requireRedWordsPath = helpers.getFilePath
export const getRedWordsUrl = helpers.getFileUrl
export const versionHasRedWords = helpers.versionSupported
export const hasRedWordsFile = helpers.hasFile
export const downloadRedWordsFile = helpers.downloadFile
export const deleteRedWordsFile = helpers.deleteFile
