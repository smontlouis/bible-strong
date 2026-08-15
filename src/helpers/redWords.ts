import { createBibleResourceHelpers } from './bibleResource'

const helpers = createBibleResourceHelpers({
  label: 'RedWords',
  identityKind: 'bible-red-words',
  getFileName: versionId => `red-words-${versionId}.json`,
  versionHasFeature: version => !!version.hasRedWords,
})

export const requireRedWordsPath = helpers.getFilePath
export const versionHasRedWords = helpers.versionSupported
export const hasRedWordsFile = helpers.hasFile
export const deleteRedWordsFile = helpers.deleteFile
