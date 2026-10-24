// What a card shows. The server builds these from the Resource API and hands them to the
// card beside the result the model reads; the card never receives text from the model.
import type { StudyLanguage } from '../language'

// --- Rich text: the formatting kept from editorial HTML ----------------------

export type Inline =
  | { t: 'text'; text: string; b?: true; i?: true; sup?: true }
  | { t: 'br' }
  /**
   * A Bible passage, named the way every tool reads it back (`John.3.16-John.3.18`). Its
   * `label` names it in full when its text does not: « 19 » after « 1 Co 14:9 ».
   */
  | { t: 'ref'; text: string; osis: string; label?: string }
  | { t: 'strong'; text: string; code: string }
  | { t: 'topic'; text: string; name: string }
  | { t: 'entry'; text: string; work: string; id: number }

export type Block =
  | { t: 'p' | 'h' | 'quote'; c: Inline[] }
  | { t: 'list'; ordered?: true; items: Block[][] }
  | { t: 'rule' }

// --- Bible text ----------------------------------------------------------------

export type TextPart =
  | { text: string; wj?: true; i?: true; b?: true }
  | { br: 'line' | 'paragraph' }

export type VerseView = {
  number: number
  parts: TextPart[]
  /** A section title printed before the verse. */
  heading?: string
  /** The verse opens a paragraph. */
  paragraph?: true
}

export type PassageSection = {
  /** « Jean 3:16-18 » */
  label: string
  osis: string
  book: number
  chapter: number
  verses: VerseView[]
  /** The version does not hold this passage. */
  missing?: true
  url?: string
}

export type PassageColumn = {
  version: string
  versionName: string
  direction: 'ltr' | 'rtl'
  sections: PassageSection[]
}

export type PassageCard = {
  kind: 'passage'
  language: StudyLanguage
  title: string
  osis: string
  columns: PassageColumn[]
  /** The passage can be read word by word in its original language. */
  words: boolean
  url?: string
}

/** Text with the words a search or a concordance found. */
export type MarkedPart = { text: string; hit?: true }

export type VerseHit = {
  label: string
  osis: string
  parts: MarkedPart[]
  note?: string
}

export type BibleSearchCard = {
  kind: 'bible_search'
  language: StudyLanguage
  title: string
  query: string
  mode: 'text' | 'meaning'
  version: string
  versionName: string
  total: number
  items: VerseHit[]
  /** What to ask to read the following results. */
  next?: Record<string, unknown>
}

// --- Original languages --------------------------------------------------------

export type Lexicon = 'hebrew' | 'greek'

export type WordView = {
  original: string
  transliteration: string
  gloss: string
  /** The entry the word belongs to (`G0026`), and how it is printed (`G26`). */
  code?: string
  label?: string
  morphology?: string
}

export type VerseWordsCard = {
  kind: 'verse_words'
  language: StudyLanguage
  title: string
  osis: string
  lexicon: Lexicon
  direction: 'ltr' | 'rtl'
  verses: {
    number: number
    label: string
    osis: string
    words: WordView[]
    translation?: { version: string; text: string }
  }[]
  url?: string
}

export type StrongSummary = {
  code: string
  label: string
  original: string
  transliteration: string
  gloss: string
}

export type StrongEntryCard = {
  kind: 'strong_entry'
  language: StudyLanguage
  title: string
  code: string
  label: string
  lexicon: Lexicon
  original: string
  transliteration: string
  pronunciation?: string
  gloss: string
  morphology?: string
  definition: Block[]
  /** The other definition of the entry, read after the first. */
  more?: Block[]
  /** The words a Bible renders the entry by, most frequent first. */
  translations: { word: string; count: number }[]
  occurrences?: { version: string; verses: number }
  related: StrongSummary[]
  /** The person or the place the entry names. */
  entity?: { uniqueName: string; name: string; brief: string }
  url?: string
  concordanceUrl?: string
}

export type StrongOccurrencesCard = {
  kind: 'strong_occurrences'
  language: StudyLanguage
  title: string
  code: string
  label: string
  original: string
  gloss: string
  version: string
  versionName: string
  /** The verses holding the word, in the whole Bible or in `scope`. */
  total?: number
  scope?: string
  items: VerseHit[]
  next?: Record<string, unknown>
  url?: string
}

// --- Editorial resources -------------------------------------------------------

export type DictionarySource = { work: string; workTitle: string; entryId: number; word: string }

export type DictionaryEntryCard = {
  kind: 'dictionary_entry'
  language: StudyLanguage
  title: string
  work: string
  workTitle: string
  entryId: number
  body: Block[]
  /** The same notion in other dictionaries. */
  others: DictionarySource[]
  url?: string
}

export type NaveTopicCard = {
  kind: 'nave_topic'
  language: StudyLanguage
  title: string
  normalizedName: string
  outline: Block[]
  referenceCount: number
  url?: string
}

export type CommentariesCard = {
  kind: 'commentaries'
  language: StudyLanguage
  title: string
  osis: string
  verse?: { version: string; text: string }
  items: {
    id: string
    name: string
    author: string
    /** The verses the comment covers: « Jean 3:16-21 ». */
    range: string
    body: Block[]
    url?: string
  }[]
}

export type CrossReferencesCard = {
  kind: 'cross_references'
  language: StudyLanguage
  title: string
  osis: string
  version: string
  verse?: string
  groups: {
    /** The words of the verse the references are filed under. */
    phrase?: string
    items: { label: string; osis: string; text?: string }[]
  }[]
  url?: string
}

export type TimelineImage = { small: string; large: string; caption: string }

export type TimelineEventSummary = {
  slug: string
  title: string
  dates: string
  summary: string
  image?: TimelineImage
}

export type TimelineCard = {
  kind: 'timeline'
  language: StudyLanguage
  title: string
  subtitle?: string
  /** The periods of biblical history, when no event was asked for. */
  periods?: { period: number; title: string; era: string; span?: string }[]
  events: TimelineEventSummary[]
  url?: string
}

export type TimelineEventCard = {
  kind: 'timeline_event'
  language: StudyLanguage
  title: string
  slug: string
  dates: string
  period?: string
  summary: string
  article: Block[]
  image?: TimelineImage
  passages: { label: string; osis: string }[]
  related: { slug: string; title: string }[]
  url?: string
}

export type EntityCard = {
  kind: 'entity'
  language: StudyLanguage
  title: string
  uniqueName: string
  category: 'person' | 'place' | 'group' | 'other'
  brief: string
  body: Block[]
  place?: { area: string; latitude?: number; longitude?: number }
  relations: { label: string; name: string; uniqueName?: string }[]
  codes: { code: string; label: string }[]
  url?: string
}

export type Card =
  | PassageCard
  | BibleSearchCard
  | VerseWordsCard
  | StrongEntryCard
  | StrongOccurrencesCard
  | DictionaryEntryCard
  | NaveTopicCard
  | CommentariesCard
  | CrossReferencesCard
  | TimelineCard
  | TimelineEventCard
  | EntityCard

export type CardKind = Card['kind']

/** Where a tool result carries its card: beside the result, out of what the model reads. */
export const CARD_META_KEY = 'bible-strong/card'
