type BibleChapterQueryRequest = {
  book: number
  chapter: number
  version: string
  strongMode?: string
  interlinearMode?: string
  interlinearLocale?: string
  interlinearLocaleAutomatic?: boolean
}

const root = ['resource'] as const
const bibleContent = [...root, 'bible-content'] as const
const lexiconBible = [...root, 'lexicon-bible'] as const
const strongBible = [...root, 'strong-bible'] as const
const strongLexicon = [...root, 'strong-lexicon'] as const
const offlineDatabase = [...root, 'offline-database'] as const
const timeline = [...root, 'timeline'] as const
const commentary = [...root, 'commentary'] as const

type LexiconBibleQueryRequest = {
  currentVersionId: string
  defaultVersionId: string
  preferredInterlinearLocale?: string
  preferredVersionId?: string
  resourceLanguage?: string
  book?: number
  chapter?: number
  verse?: number
  reference?: string
  allBooks?: boolean
  lexemeId?: number
  limit?: number
}

export const resourceQueryKeys = {
  all: () => root,
  bibleContent: () => bibleContent,
  bibleVersion: (versionId: string) => [...bibleContent, 'version', versionId] as const,
  bibleChapter: (request: BibleChapterQueryRequest) =>
    [...bibleContent, 'chapter', request] as const,
  bibleVerseSelection: (versionId: string, verseKeys: readonly string[]) =>
    [...bibleContent, 'verse-selection', versionId, verseKeys] as const,
  biblePericope: (versionId: string) => [...bibleContent, 'pericope', versionId] as const,
  bibleParallel: (request: {
    book: number
    chapter: number
    versions: readonly string[]
    strongMode?: string
    interlinearMode?: string
    interlinearLocale?: string
    interlinearLocaleAutomatic?: boolean
  }) => [...bibleContent, 'parallel', request] as const,
  bibleComments: (request: { book: number; chapter: number; language: string }) =>
    [...bibleContent, 'comments', request] as const,
  bibleReferences: (verse: string) => [...bibleContent, 'references', verse] as const,
  bibleRedWords: (versionId: string) => [...bibleContent, 'red-words', versionId] as const,
  bibleCoverage: (versionId: string) => [...bibleContent, 'coverage', versionId] as const,
  commentary: () => commentary,
  commentaryCoverage: (resourceId: string, language: string) =>
    [...commentary, 'coverage', resourceId, language] as const,
  lexiconBible: () => lexiconBible,
  lexiconBibleVerse: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'verse', request] as const,
  lexiconBibleVerseEnrichment: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'verse-enrichment', request] as const,
  lexiconBibleCounts: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'counts', request] as const,
  lexiconBibleLemmaStats: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'lemma-stats', request] as const,
  lexiconBibleConcordance: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'concordance', request] as const,
  lexiconBibleConcordancePreview: (request: LexiconBibleQueryRequest) =>
    [...lexiconBible, 'concordance-preview', request] as const,
  lexiconBibleVerseSelection: (request: LexiconBibleQueryRequest & { verseKeys: string[] }) =>
    [...lexiconBible, 'verse-selection', request] as const,
  strongBible: () => strongBible,
  strongBibleChapterCodes: (request: {
    currentVersionId: string
    defaultVersionId: string
    book: number
    chapter: number
    expectedTextRevision?: string
    expectedTextSha256?: string
  }) => [...strongBible, 'chapter-codes', request] as const,
  strongBibleCounts: (request: LexiconBibleQueryRequest) =>
    [...strongBible, 'counts', request] as const,
  strongBibleOccurrences: (request: LexiconBibleQueryRequest) =>
    [...strongBible, 'occurrences', request] as const,
  strongLexicon: () => strongLexicon,
  strongLexiconAvailability: (moduleId: string) =>
    [...strongLexicon, 'availability', moduleId] as const,
  strongLexiconEntryCards: (language: string, identities: readonly string[]) =>
    [...strongLexicon, 'entry-cards', language, identities] as const,
  strongLexiconChapterEntities: (request: {
    language: string
    book: number
    chapter: number
    strongCodes: readonly string[]
  }) => [...strongLexicon, 'chapter-entities', request] as const,
  offlineDatabaseAvailability: (databaseId: string, language: string) =>
    [...offlineDatabase, 'availability', databaseId, language] as const,
  timeline: (language: string) => [...timeline, language] as const,
}
