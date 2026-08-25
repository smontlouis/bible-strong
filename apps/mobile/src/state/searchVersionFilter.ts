export const DEFAULT_BIBLE_VERSION_FILTER = '__default_bible_version__'

export const resolveSearchVersionFilter = (
  selectedVersion: string,
  defaultBibleVersion: string
): string =>
  selectedVersion === DEFAULT_BIBLE_VERSION_FILTER ? defaultBibleVersion : selectedVersion
