// What the reader shows under a verse in focus (ADR-0088). It crosses into the Bible DOM, so
// it holds plain data only. A section left undefined is still loading; an empty one is hidden.

export type FocusStudyVersion = { versionId: string; name: string; text: string }

export type FocusStudyWord = {
  /** The word as the Bible read writes it; an original word left untranslated has none. */
  word?: string
  original: string
  transliteration?: string
  gloss?: string
  /** The number shown to the reader, such as G1803. */
  label: string
  identityKind: string
  identityCode: string
}

export type FocusStudyReference = { verseKey: string; title: string; text: string }

export type FocusStudyCommentary = {
  /** `<commentary id>:<language>`, what opens the commentary. */
  projectionId: string
  title: string
  verses: string
  text: string
}

export type FocusStudyTopic = { name: string; nameLower: string }

export type FocusStudyDictionaryEntry = {
  word: string
  entryId: number
  work: string
  resourceId: string
  title: string
  language: string
  correspondenceId?: string
}

export type FocusVerseStudy = {
  verseKey: string
  /** The verse numbers of the focus the reader can study, when it holds several. */
  studyVerses: number[]
  versions?: FocusStudyVersion[]
  /** Whether the versions are the reader's compared ones, not the best-known of the language. */
  versionsCompared: boolean
  original?: string
  words?: FocusStudyWord[]
  wordCount: number
  references?: FocusStudyReference[]
  referenceCount: number
  commentaries?: FocusStudyCommentary[]
  commentaryCount: number
  topics?: FocusStudyTopic[]
  dictionary?: FocusStudyDictionaryEntry[]
}

export type FocusStudyTranslations = {
  title: string
  versions: string
  compareAll: string
  chooseVersions: string
  words: string
  wordsAll: string
  references: string
  referencesAll: string
  commentaries: string
  commentariesAll: string
  topics: string
  dictionary: string
  entities: string
  studyVerse: string
}
