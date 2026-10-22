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

export type FocusStudyCommentary = { title: string; verses: string; text: string }

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

export type FocusStudyResource =
  | 'compare'
  | 'strong'
  | 'reference'
  | 'commentary'
  | 'nave'
  | 'dictionary'

/** A tap in the study, sent from the Bible DOM to the reader. */
export type FocusStudyAction =
  | { kind: 'study-verse'; verse: number }
  | { kind: 'open-resource'; resource: FocusStudyResource }
  | { kind: 'open-reference'; verseKey: string }
  | { kind: 'open-word'; identityKind: string; identityCode: string }
  | { kind: 'open-topic'; name: string; nameLower: string }
  | { kind: 'open-dictionary'; entry: FocusStudyDictionaryEntry }

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
  studyVerse: string
}

const FOCUS_STUDY_RESOURCES: readonly string[] = [
  'compare',
  'strong',
  'reference',
  'commentary',
  'nave',
  'dictionary',
] satisfies FocusStudyResource[]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Whether a payload sent by the Bible DOM is a tap of the study the reader can act on. */
export const isFocusStudyAction = (value: unknown): value is FocusStudyAction => {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'study-verse':
      return Number.isSafeInteger(value.verse)
    case 'open-resource':
      return typeof value.resource === 'string' && FOCUS_STUDY_RESOURCES.includes(value.resource)
    case 'open-reference':
      return typeof value.verseKey === 'string' && /^\d+-\d+-\d+$/u.test(value.verseKey)
    case 'open-word':
      return typeof value.identityKind === 'string' && typeof value.identityCode === 'string'
    case 'open-topic':
      return typeof value.name === 'string' && typeof value.nameLower === 'string'
    case 'open-dictionary':
      return (
        isRecord(value.entry) &&
        typeof value.entry.word === 'string' &&
        typeof value.entry.entryId === 'number' &&
        typeof value.entry.work === 'string' &&
        typeof value.entry.resourceId === 'string'
      )
    default:
      return false
  }
}
