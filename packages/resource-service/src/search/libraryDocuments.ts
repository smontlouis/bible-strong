// Passages of the library search index (ADR-0103), built from the rows of active
// publications. Each passage keeps what the assistant needs to open the exact resource
// (`target`), the attribution it must give (work, tradition) and the verses it is about.
import { COMMENTARY_CATALOG } from '@bible-strong/resource-catalog/commentaries'

import { htmlToPlainText, splitIntoPassages } from './libraryText'

export const LIBRARY_CORPORA = [
  'commentary',
  'dictionary',
  'nave',
  'timeline',
  'entity',
  'document',
] as const
export type LibraryCorpus = (typeof LIBRARY_CORPORA)[number]
export type LibraryLanguage = 'fr' | 'en'

/** What the read tools need to open the resource a passage comes from. */
export type LibraryTarget =
  | {
      kind: 'commentary'
      resourceId: string
      language: LibraryLanguage
      sectionId: string
      book: number
      chapter: number
    }
  | { kind: 'dictionary'; work: string; language: LibraryLanguage; entryId: number }
  | { kind: 'nave'; language: LibraryLanguage; normalizedName: string }
  | { kind: 'timeline'; language: LibraryLanguage; slug: string }
  | { kind: 'entity'; language: LibraryLanguage; uniqueName: string }
  // A document of a collection (ADR-0106): its passages, in order, are its whole text.
  | {
      kind: 'document'
      collection: string
      language: LibraryLanguage
      documentKey: string
      part: number
      url?: string
      /** Short labels its prepared file gives the document (ADR-0106). */
      labels?: string[]
    }

export type LibraryPassageDraft = {
  passageKey: string
  corpus: LibraryCorpus
  language: LibraryLanguage
  work: string
  workTitle: string
  tradition: string | null
  tags: string[]
  title: string
  heading: string
  book: number | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  part: number
  content: string
  target: LibraryTarget
}

const BOOKS: Record<LibraryLanguage, readonly string[]> = {
  fr: [
    'Genèse',
    'Exode',
    'Lévitique',
    'Nombres',
    'Deutéronome',
    'Josué',
    'Juges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Rois',
    '2 Rois',
    '1 Chroniques',
    '2 Chroniques',
    'Esdras',
    'Néhémie',
    'Esther',
    'Job',
    'Psaumes',
    'Proverbes',
    'Ecclésiaste',
    'Cantique des cantiques',
    'Ésaïe',
    'Jérémie',
    'Lamentations',
    'Ézéchiel',
    'Daniel',
    'Osée',
    'Joël',
    'Amos',
    'Abdias',
    'Jonas',
    'Michée',
    'Nahum',
    'Habacuc',
    'Sophonie',
    'Aggée',
    'Zacharie',
    'Malachie',
    'Matthieu',
    'Marc',
    'Luc',
    'Jean',
    'Actes',
    'Romains',
    '1 Corinthiens',
    '2 Corinthiens',
    'Galates',
    'Éphésiens',
    'Philippiens',
    'Colossiens',
    '1 Thessaloniciens',
    '2 Thessaloniciens',
    '1 Timothée',
    '2 Timothée',
    'Tite',
    'Philémon',
    'Hébreux',
    'Jacques',
    '1 Pierre',
    '2 Pierre',
    '1 Jean',
    '2 Jean',
    '3 Jean',
    'Jude',
    'Apocalypse',
  ],
  en: [
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Proverbs',
    'Ecclesiastes',
    'Song of Songs',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
  ],
}

export const passageReference = (
  language: LibraryLanguage,
  book: number,
  chapter: number,
  start?: number | null,
  end?: number | null
) => {
  const name = BOOKS[language][book - 1] ?? String(book)
  if (!start) return `${name} ${chapter}`
  return end && end !== start ? `${name} ${chapter}:${start}-${end}` : `${name} ${chapter}:${start}`
}

const LABELS: Record<
  LibraryLanguage,
  Record<'commentary' | 'dictionary' | 'nave' | 'timeline' | 'entity', string>
> = {
  fr: {
    commentary: 'commentaire sur',
    dictionary: 'dictionnaire',
    nave: 'Nave, thème',
    timeline: 'chronologie biblique',
    entity: 'personnage ou lieu biblique',
  },
  en: {
    commentary: 'commentary on',
    dictionary: 'dictionary',
    nave: 'Nave topic',
    timeline: 'biblical timeline',
    entity: 'biblical person or place',
  },
}

const isLanguage = (value: string | null | undefined): value is LibraryLanguage =>
  value === 'fr' || value === 'en'

const pieces = (text: string) => splitIntoPassages(text)

// --- Commentaries -------------------------------------------------------------------------

export type CommentaryPublication = { collection: string; language: string }
export type CommentarySectionRow = {
  id: string
  book: number
  chapter: number
  range_start_verse: number
  range_end_verse: number
  content: string
}

export const commentaryWork = (collection: string) => {
  const entry = COMMENTARY_CATALOG.find(
    item => item.publicationId === collection || item.id === collection
  )
  return {
    title: entry?.title ?? collection,
    shortName: entry?.shortName ?? collection,
    tradition: entry?.tradition ?? null,
    tags: [...(entry?.tags ?? [])],
  }
}

/**
 * What the index leaves out of a commentary (ADR-0106): by collection, the pattern of the part of
 * each section to cut, from the index policy file. The pattern runs case-insensitively.
 */
export type LibrarySectionCuts = Readonly<Record<string, RegExp>>

/** Reads the `sectionCuts` of an index policy: { "sectionCuts": { "<collection>": "<pattern>" } }. */
export const librarySectionCuts = (policy: unknown): LibrarySectionCuts => {
  const cuts = (policy as { sectionCuts?: unknown } | null)?.sectionCuts ?? {}
  if (!cuts || typeof cuts !== 'object' || Array.isArray(cuts))
    throw new Error('LIBRARY_POLICY_INVALID')
  return Object.fromEntries(
    Object.entries(cuts).map(([collection, pattern]) => {
      if (!/^[a-z0-9-]{1,64}$/u.test(collection) || typeof pattern !== 'string' || !pattern)
        throw new Error('LIBRARY_POLICY_INVALID')
      return [collection, new RegExp(pattern, 'iu')]
    })
  )
}

/** The HTML of a section as the index reads it. */
export const indexedSectionContent = (
  collection: string,
  content: string,
  cuts: LibrarySectionCuts = {}
) => (cuts[collection] ? content.replace(cuts[collection], '') : content)

export const commentaryPassages = (
  publication: CommentaryPublication,
  section: CommentarySectionRow,
  cuts: LibrarySectionCuts = {}
): LibraryPassageDraft[] => {
  if (!isLanguage(publication.language)) return []
  const language = publication.language
  const work = commentaryWork(publication.collection)
  const title = passageReference(
    language,
    section.book,
    section.chapter,
    section.range_start_verse,
    section.range_end_verse
  )
  const tradition = [work.tradition, ...work.tags].filter(Boolean).join(', ')
  const heading = `${work.shortName}${tradition ? ` (${tradition})` : ''}, ${LABELS[language].commentary} ${title}`
  return pieces(htmlToPlainText(indexedSectionContent(publication.collection, section.content, cuts))).map((content, part) => ({
    passageKey: `${section.id}#${part}`,
    corpus: 'commentary',
    language,
    work: publication.collection,
    workTitle: work.title,
    tradition: work.tradition,
    tags: work.tags,
    title,
    heading,
    book: section.book,
    chapter: section.chapter,
    verseStart: section.range_start_verse,
    verseEnd: section.range_end_verse,
    part,
    content,
    target: {
      kind: 'commentary',
      resourceId: publication.collection,
      language,
      sectionId: section.id,
      book: section.book,
      chapter: section.chapter,
    },
  }))
}

// --- Dictionaries -------------------------------------------------------------------------

const DICTIONARY_TITLES: Record<string, string> = {
  bost: 'Dictionnaire Bost',
  calmet: 'Dictionnaire Calmet',
  lelievre: 'Dictionnaire Lelièvre',
  westphal: 'Dictionnaire Westphal',
  'easton-webster': 'Easton’s Bible Dictionary',
  isbe: 'International Standard Bible Encyclopedia',
  smith: 'Smith’s Bible Dictionary',
  'unfoldingword-translation-words': 'unfoldingWord Translation Words',
}

/** `dictionary:<work>:<language>`; the legacy aggregates `dictionary:fr` and `dictionary:en` repeat a work. */
export const dictionaryWorkFromIdentity = (identity: string) =>
  /^dictionary:([a-z0-9-]+):(fr|en)$/u.exec(identity)?.[1]

export type DictionaryEntryRow = { entry_id: number; word: string; definition: string }

export const dictionaryPassages = (
  work: string,
  language: string,
  entry: DictionaryEntryRow
): LibraryPassageDraft[] => {
  if (!isLanguage(language)) return []
  const workTitle = DICTIONARY_TITLES[work] ?? work
  const word = htmlToPlainText(entry.word)
  return pieces(htmlToPlainText(entry.definition)).map((content, part) => ({
    passageKey: `${entry.entry_id}#${part}`,
    corpus: 'dictionary',
    language,
    work,
    workTitle,
    tradition: null,
    tags: [],
    title: word,
    heading: `${workTitle}, ${word}`,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    part,
    content,
    target: { kind: 'dictionary', work, language, entryId: entry.entry_id },
  }))
}

// --- Nave -------------------------------------------------------------------------------

export type NaveTopicRow = { normalized_name: string; name: string; description: string }

export const navePassages = (language: string, topic: NaveTopicRow): LibraryPassageDraft[] => {
  if (!isLanguage(language)) return []
  const name = htmlToPlainText(topic.name)
  return pieces(htmlToPlainText(topic.description)).map((content, part) => ({
    passageKey: `${topic.normalized_name}#${part}`,
    corpus: 'nave',
    language,
    work: 'nave',
    workTitle: language === 'fr' ? 'Nave, index thématique' : 'Nave’s Topical Bible',
    tradition: null,
    tags: [],
    title: name,
    heading: `${LABELS[language].nave} ${name}`,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    part,
    content,
    target: { kind: 'nave', language, normalizedName: topic.normalized_name },
  }))
}

// --- Timeline ---------------------------------------------------------------------------

export type TimelineEventRow = {
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
}

export const timelinePassages = (
  language: string,
  event: TimelineEventRow
): LibraryPassageDraft[] => {
  if (!isLanguage(language)) return []
  const title = htmlToPlainText(event.title)
  // `period` is an ordinal of the timeline, not a label: the dates say when.
  const context = htmlToPlainText(event.dates)
  const text = [htmlToPlainText(event.description), htmlToPlainText(event.article)]
    .filter(Boolean)
    .join('\n')
  return pieces(text).map((content, part) => ({
    passageKey: `${event.slug}#${part}`,
    corpus: 'timeline',
    language,
    work: 'timeline',
    workTitle: language === 'fr' ? 'Chronologie biblique' : 'Biblical timeline',
    tradition: null,
    tags: [],
    title,
    heading: `${LABELS[language].timeline}, ${title}${context ? ` (${context})` : ''}`,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    part,
    content,
    target: { kind: 'timeline', language, slug: event.slug },
  }))
}

// --- People and places --------------------------------------------------------------------

export type EntityTranslationRow = {
  unique_name: string
  language: string
  payload: Record<string, unknown>
}

const field = (payload: Record<string, unknown>, key: string) =>
  typeof payload[key] === 'string' ? htmlToPlainText(payload[key] as string) : ''

export const entityPassages = (row: EntityTranslationRow): LibraryPassageDraft[] => {
  if (!isLanguage(row.language)) return []
  const language = row.language
  const name = field(row.payload, 'displayName') || row.unique_name
  const text = [
    field(row.payload, 'shortDescription') || field(row.payload, 'brief'),
    field(row.payload, 'articleHtml'),
  ]
    .filter(Boolean)
    .join('\n')
  if (!text) return []
  return pieces(text).map((content, part) => ({
    passageKey: `${row.unique_name}#${part}`,
    corpus: 'entity',
    language,
    work: 'entities',
    workTitle: language === 'fr' ? 'Personnages et lieux bibliques' : 'Biblical people and places',
    tradition: null,
    tags: [],
    title: name,
    heading: `${LABELS[language].entity}, ${name}`,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    part,
    content,
    target: { kind: 'entity', language, uniqueName: row.unique_name },
  }))
}
