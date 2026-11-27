import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import {
  bibleVersification,
  convertRange,
  convertVerseKey,
  convertVerseKeyToOne,
  lastVerseOfChapter,
  parseVerseKey,
  RESOURCE_VERSIFICATIONS,
  versesOfRange,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import { compareText } from '~helpers/compareText'

/**
 * A verse-keyed resource read beside a chapter of a Bible: the resource may number the chapter's
 * verses its own way (docs/research/versification-adr-draft.md). These helpers find the resource
 * chapters a reader chapter maps to and bring the resource's verse numbers back into the reader's
 * numbering. When either numbering is unknown, or both are the same, nothing is converted.
 */
export type ReaderChapter = {
  /** The Bible being read, whose numbering the verses are shown in. */
  version: string | undefined
  book: number
  chapter: number
}

/** The `kind:id` key of a commentary, from its catalog or its publication id. */
export const commentaryResourceKey = (resourceId: string) =>
  `commentary:${COMMENTARY_CATALOG_BY_ID.get(resourceId)?.publicationId ?? resourceId}`

export const ENTITIES_RESOURCE_KEY = 'entities:tipnr'

type Numberings = { reader: VersificationId; resource: VersificationId }

/** Both numberings when a conversion is needed, else undefined (identity). */
const numberingsOf = (version: string | undefined, resource: string): Numberings | undefined => {
  const reader = version ? bibleVersification(version) : undefined
  const resourceNumbering = RESOURCE_VERSIFICATIONS[resource]
  return reader && resourceNumbering && reader !== resourceNumbering
    ? { reader, resource: resourceNumbering }
    : undefined
}

/**
 * The resource chapters that hold the verses of a reader chapter, in canonical order: LSG
 * Malachi 3 is KJV Malachi 3 and 4. The reader's chapter alone when nothing is converted.
 */
export const resourceChaptersForReaderChapter = (
  { version, book, chapter }: ReaderChapter,
  resource: string
): number[] => {
  const numberings = numberingsOf(version, resource)
  const lastVerse = numberings && lastVerseOfChapter(numberings.reader, book, chapter)
  if (!numberings || lastVerse === undefined) return [chapter]
  const chapters = new Set<number>()
  for (let verse = 1; verse <= lastVerse; verse++) {
    for (const key of convertVerseKey(
      `${book}-${chapter}-${verse}`,
      numberings.reader,
      numberings.resource
    )) {
      const ref = parseVerseKey(key)
      if (ref?.book === book) chapters.add(ref.chapter)
    }
  }
  return [...chapters].sort((left, right) => left - right)
}

/**
 * The verses of the reader chapter a verse of a resource chapter corresponds to: KJV Psalm 51:1,
 * which holds the title, is LSG Psalm 51:1, 2 and 3. Empty when it falls in another chapter of
 * the reader's Bible or has no equivalent.
 */
export const resourceVerseInReaderChapter = (
  reader: ReaderChapter,
  resource: string,
  resourceChapter: number,
  verse: number
): number[] => {
  const numberings = numberingsOf(reader.version, resource)
  if (!numberings) return resourceChapter === reader.chapter ? [verse] : []
  return convertVerseKey(
    `${reader.book}-${resourceChapter}-${verse}`,
    numberings.resource,
    numberings.reader
  ).flatMap(key => {
    const ref = parseVerseKey(key)
    return ref && ref.book === reader.book && ref.chapter === reader.chapter ? [ref.verse] : []
  })
}

/**
 * A range of a resource chapter in the reader's chapter, clipped to it: KJV Malachi 4:5-6 is LSG
 * Malachi 3:23-24, KJV Psalm 51:1-4 is LSG Psalm 51:1-6 (the KJV verse 1 holds the title).
 * Undefined when no verse of the range lands in the reader's chapter.
 */
export const resourceRangeInReaderChapter = (
  reader: ReaderChapter,
  resource: string,
  resourceChapter: number,
  range: { start: number; end: number }
): { start: number; end: number } | undefined => {
  const numberings = numberingsOf(reader.version, resource)
  if (!numberings) {
    return resourceChapter === reader.chapter ? { start: range.start, end: range.end } : undefined
  }
  const resourceRange = {
    start: { book: reader.book, chapter: resourceChapter, verse: range.start },
    end: { book: reader.book, chapter: resourceChapter, verse: range.end },
  }
  // A range the table does not know is kept as it is, as `convertVerseKey` keeps such a verse.
  if (versesOfRange(numberings.resource, resourceRange).length === 0) {
    return resourceChapter === reader.chapter ? { start: range.start, end: range.end } : undefined
  }
  const converted = convertRange(numberings.resource, numberings.reader, resourceRange)
  if (!converted || converted.start.book !== reader.book) return undefined
  const { start, end } = converted
  if (start.chapter > reader.chapter || end.chapter < reader.chapter) return undefined
  const lastVerse = lastVerseOfChapter(numberings.reader, reader.book, reader.chapter) ?? end.verse
  return {
    start: start.chapter < reader.chapter ? 1 : start.verse,
    end: end.chapter > reader.chapter ? lastVerse : end.verse,
  }
}

/**
 * Whether the introduction of a resource chapter introduces the reader's chapter: the resource
 * chapter must open it. The introduction of KJV Malachi 4 is not that of LSG Malachi 3.
 */
export const resourceChapterOpensReaderChapter = (
  reader: ReaderChapter,
  resource: string,
  resourceChapter: number
) => resourceVerseInReaderChapter(reader, resource, resourceChapter, 1).includes(1)

/**
 * The verse of a resource that stands for a verse of a Bible, in the resource's numbering. The
 * same key when nothing is converted; undefined when the verse has no equivalent.
 */
export const bibleVerseInResource = (
  verseKey: string,
  version: string | undefined,
  resource: string
) => {
  const numberings = numberingsOf(version, resource)
  return numberings
    ? convertVerseKeyToOne(verseKey, numberings.reader, numberings.resource)
    : verseKey
}

/**
 * A passage a resource names (in its numbering) in the Bible that will open: its first verse
 * that holds more than a Psalm title, to its last verse, within the chapter of the first. The
 * passage unchanged when nothing is converted; undefined when no verse has an equivalent.
 */
export const resourcePassageInBible = (
  passage: { book: number; chapter: number; startVerse: number; endVerse: number },
  resource: string | undefined,
  version: string | undefined
): { book: number; chapter: number; startVerse: number; endVerse: number } | undefined => {
  const numberings = resource ? numberingsOf(version, resource) : undefined
  if (!numberings) return passage
  const { book, chapter } = passage
  const verses = Array.from(
    { length: Math.max(0, passage.endVerse - passage.startVerse + 1) },
    (_, index) => passage.startVerse + index
  )
  const keyOf = (verse: number) => `${book}-${chapter}-${verse}`
  const startKey = verses
    .map(verse => convertVerseKeyToOne(keyOf(verse), numberings.resource, numberings.reader))
    .find(Boolean)
  const endKey = [...verses]
    .reverse()
    .map(verse => convertVerseKey(keyOf(verse), numberings.resource, numberings.reader).at(-1))
    .find(Boolean)
  const start = startKey ? parseVerseKey(startKey) : undefined
  const end = endKey ? parseVerseKey(endKey) : undefined
  if (!start) return undefined
  const sameChapter = end && end.book === start.book && end.chapter === start.chapter
  const endVerse = sameChapter
    ? end.verse
    : end && (end.book !== start.book || end.chapter > start.chapter)
      ? (lastVerseOfChapter(numberings.reader, start.book, start.chapter) ?? start.verse)
      : start.verse
  return {
    book: start.book,
    chapter: start.chapter,
    startVerse: start.verse,
    endVerse: Math.max(start.verse, endVerse),
  }
}

const ENTITY_CATEGORY_ORDER = ['person', 'place', 'group']

/**
 * The entities of the resource chapters a reader chapter maps to, with their verses in the
 * reader's numbering. An entity is kept when one of its verses lands in the reader's chapter, or
 * when it came without verses (matched by a Strong code of the chapter). One resource chapter
 * read without conversion is returned as it came.
 */
export const entitiesInReaderChapter = <
  Entity extends { uniqueName: string; name: string; category: string; verses: number[] },
>(
  reader: ReaderChapter,
  loaded: readonly { chapter: number; entities: readonly Entity[] }[]
): Entity[] => {
  if (
    !numberingsOf(reader.version, ENTITIES_RESOURCE_KEY) &&
    loaded.length === 1 &&
    loaded[0].chapter === reader.chapter
  ) {
    return [...loaded[0].entities]
  }
  const merged = new Map<string, Entity>()
  for (const { chapter, entities } of loaded) {
    for (const entity of entities) {
      const verses = entity.verses.flatMap(verse =>
        resourceVerseInReaderChapter(reader, ENTITIES_RESOURCE_KEY, chapter, verse)
      )
      if (verses.length === 0 && entity.verses.length > 0) continue
      const existing = merged.get(entity.uniqueName)
      merged.set(entity.uniqueName, {
        ...(existing ?? entity),
        verses: [...new Set([...(existing?.verses ?? []), ...verses])].sort(
          (left, right) => left - right
        ),
      })
    }
  }
  const rank = (category: string) => {
    const index = ENTITY_CATEGORY_ORDER.indexOf(category)
    return index < 0 ? ENTITY_CATEGORY_ORDER.length : index
  }
  const entities = [...merged.values()]
  return loaded.length > 1
    ? entities.sort(
        (left, right) =>
          rank(left.category) - rank(right.category) || compareText(left.name, right.name)
      )
    : entities
}

/**
 * Items grouped by the resource chapter they must be read in for a reader chapter, in canonical
 * order, so that a chapter is asked for once for every item that needs it.
 */
export const groupByResourceChapter = <Item>(
  reader: ReaderChapter,
  items: readonly Item[],
  resourceOf: (item: Item) => string
): { chapter: number; items: Item[] }[] => {
  const groups = new Map<number, Item[]>()
  for (const item of items) {
    for (const chapter of resourceChaptersForReaderChapter(reader, resourceOf(item))) {
      groups.set(chapter, [...(groups.get(chapter) ?? []), item])
    }
  }
  return [...groups]
    .sort(([left], [right]) => left - right)
    .map(([chapter, grouped]) => ({ chapter, items: grouped }))
}

/** The entities of a reader chapter, read in the chapters of the entity publication it maps to. */
export const loadReaderChapterEntities = async <
  Entity extends { uniqueName: string; name: string; category: string; verses: number[] },
>(
  reader: ReaderChapter,
  load: (chapter: number) => Promise<Entity[]>
): Promise<Entity[]> => {
  const chapters = resourceChaptersForReaderChapter(reader, ENTITIES_RESOURCE_KEY)
  const loaded = await Promise.all(
    chapters.map(async chapter => ({ chapter, entities: await load(chapter) }))
  )
  return entitiesInReaderChapter(reader, loaded)
}
