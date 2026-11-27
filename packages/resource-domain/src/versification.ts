/**
 * Verse numbering systems and the conversion of verse references between them, through the
 * Paratext `org` numbering as pivot (docs/research/versification-adr-draft.md).
 *
 * A versification is a Paratext table, optionally followed by Bible Strong overlays that list
 * only what differs. Only the 66 books of the Protestant canon are described for now: a verse
 * of another book has no correspondence.
 *
 * The module loads nothing and reads no network: the app, the site, the Resource service and
 * the study assistant use the same tables online and offline.
 */
import { expandVrsMapping, type VrsTable, type VrsVerse } from './versification/vrsParser'
import type {
  BibleStrongOverlayId,
  ParatextTableId,
  VersificationTables,
} from './versification/versificationSources'
import compiledTables from './versification/tables.json'

export type VersificationId = 'org' | 'bs-eng' | 'bs-kjv' | 'bs-nrsv'

/** The numbering every conversion goes through, and the one new internal keys are written in. */
export const PIVOT_VERSIFICATION = 'org' satisfies VersificationId

export interface VerseRef {
  book: number
  chapter: number
  verse: number
}

export interface VerseCorrespondence {
  /** The corresponding verses in canonical order; empty when the verse has no equivalent. */
  verses: VerseRef[]
  /** True when exactly one verse corresponds, and it corresponds to that verse alone. */
  exact: boolean
}

export interface VerseRange {
  start: VerseRef
  end: VerseRef
}

interface VersificationDefinition {
  table: ParatextTableId
  /** The Bibles of this numbering have no verse 0: a Psalm title belongs to verse 1. */
  foldPsalmTitlesIntoVerse1?: boolean
  overlays?: readonly BibleStrongOverlayId[]
}

const DEFINITIONS: Record<VersificationId, VersificationDefinition> = {
  org: { table: 'org' },
  'bs-eng': { table: 'eng', foldPsalmTitlesIntoVerse1: true, overlays: ['eng-fixes', 'bs-eng'] },
  'bs-kjv': {
    table: 'eng',
    foldPsalmTitlesIntoVerse1: true,
    overlays: ['eng-fixes', 'bs-eng', 'bs-kjv'],
  },
  'bs-nrsv': { table: 'eng', overlays: ['eng-fixes', 'bs-nrsv'] },
}

export const VERSIFICATION_IDS = Object.keys(DEFINITIONS) as VersificationId[]

export const isVersificationId = (value: string): value is VersificationId =>
  Object.prototype.hasOwnProperty.call(DEFINITIONS, value)

/**
 * The versification each published Bible follows, measured on its coverage. A Bible missing
 * here follows no described numbering yet, and its references are not converted.
 */
export const BIBLE_VERSIFICATIONS: Readonly<Record<string, VersificationId>> = {
  LSG: 'org',
  NBS: 'org',
  NVS78P: 'org',
  DBY: 'org',
  DBR: 'org',
  S21: 'org',
  BDS: 'org',
  BHS: 'org',
  NLT: 'bs-eng',
  KJV: 'bs-kjv',
  KJF: 'bs-kjv',
  BSB: 'bs-kjv',
  ASV: 'bs-kjv',
  DARBY: 'bs-kjv',
  RLT: 'bs-kjv',
  RWEBSTER: 'bs-kjv',
  RV1895: 'bs-kjv',
  NKJV: 'bs-kjv',
  NASB2020: 'bs-kjv',
  NASB1995: 'bs-kjv',
  TR1624: 'bs-kjv',
  TR1894: 'bs-kjv',
  BHG: 'bs-nrsv',
}

/**
 * The versification of the verse keys of each verse-keyed resource, keyed `kind:id`; a
 * commentary by its publication id. A resource missing here has not been measured: it is read
 * at the reader's verse, as before conversion.
 */
export const RESOURCE_VERSIFICATIONS: Readonly<Record<string, VersificationId>> = {
  'cross-references:TRESOR': 'bs-kjv',
  'nave:fr': 'bs-kjv',
  'nave:en': 'bs-kjv',
  'commentary:acbc': 'bs-kjv',
  'commentary:barnes': 'bs-kjv',
  'commentary:mhcc': 'bs-kjv',
  'commentary:jfb': 'bs-kjv',
  'commentary:sdabc': 'bs-kjv',
  'commentary:egw-writings': 'bs-kjv',
  'commentary:kd': 'bs-kjv',
  'commentary:wesley': 'bs-kjv',
  'commentary:mhc': 'bs-kjv',
  'commentary:calvin': 'bs-kjv',
  'commentary:geneva-notes': 'bs-kjv',
  'commentary:darby-notes': 'bs-kjv',
  'commentary:scofield': 'bs-kjv',
  'commentary:king-comments': 'bs-kjv',
  'commentary:treasury-david': 'bs-kjv',
  'commentary:rashi-en': 'org',
  // The STEPBible people and places: 2 Corinthians 13 in 14 verses, Revelation 12 in 17, a
  // Psalm title in verse 1 (Bathsheba in Psalm 51:1).
  'entities:tipnr': 'bs-kjv',
  // Dictionary verse presences are found in a reference Bible of each language.
  'dictionary-presence:fr': 'org',
  'dictionary-presence:en': 'bs-kjv',
}

export const bibleVersification = (versionId: string): VersificationId | undefined =>
  BIBLE_VERSIFICATIONS[versionId]

export const resourceVersification = (kind: string, id: string): VersificationId | undefined =>
  RESOURCE_VERSIFICATIONS[`${kind}:${id}`]

// --- Verse keys -----------------------------------------------------------------------------

/** `book-chapter-verse`, the verse key of the Resource API. */
export const formatVerseKey = ({ book, chapter, verse }: VerseRef): string =>
  `${book}-${chapter}-${verse}`

export const parseVerseKey = (key: string): VerseRef | undefined => {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(key)
  return match
    ? { book: Number(match[1]), chapter: Number(match[2]), verse: Number(match[3]) }
    : undefined
}

export const compareVerseRefs = (left: VerseRef, right: VerseRef): number =>
  left.book - right.book || left.chapter - right.chapter || left.verse - right.verse

// --- Tables ---------------------------------------------------------------------------------

interface VersificationIndex {
  /** The last verse of each chapter, by book; index 0 is chapter 1. */
  lastVerses: Map<number, number[]>
  /** The verses numbered 0 that exist, by verse key. */
  zeroVerses: Set<string>
  /**
   * Verse key in this versification → the org verses it maps to. Every verse is listed: a
   * verse no mapping names corresponds to the org verse of the same number, if there is one.
   */
  forward: Map<string, VerseRef[]>
  /** Org verse key → the verses of this versification that map to it. */
  reverse: Map<string, VerseRef[]>
}

const tables = compiledTables as unknown as VersificationTables

const toRef = ([book, chapter, verse]: VrsVerse): VerseRef => ({ book, chapter, verse })

const applyChapters = (lastVerses: Map<number, number[]>, table: VrsTable): void => {
  for (const [book, chapter, lastVerse] of table.chapters) {
    const chapters = lastVerses.get(book) ?? []
    chapters[chapter - 1] = lastVerse
    lastVerses.set(book, chapters)
  }
}

const addTo = (map: Map<string, VerseRef[]>, key: string, ref: VerseRef): void => {
  const refs = map.get(key) ?? []
  if (!refs.some(existing => compareVerseRefs(existing, ref) === 0)) {
    refs.push(ref)
    refs.sort(compareVerseRefs)
  }
  map.set(key, refs)
}

const buildIndex = (definition: VersificationDefinition): VersificationIndex => {
  const lastVerses = new Map<number, number[]>()
  applyChapters(lastVerses, tables.paratext[definition.table])
  let pairs = tables.paratext[definition.table].mappings
    .flatMap(expandVrsMapping)
    .map(
      ([from, to]) =>
        [
          definition.foldPsalmTitlesIntoVerse1 && from[2] === 0
            ? ([from[0], from[1], 1] as const)
            : from,
          to,
        ] as const
    )
  for (const overlayId of definition.overlays ?? []) {
    const overlay = tables.overlays[overlayId]
    applyChapters(lastVerses, overlay)
    const overlayPairs = overlay.mappings.flatMap(expandVrsMapping)
    const replaced = new Set(overlayPairs.map(([from]) => formatVerseKey(toRef(from))))
    pairs = [
      ...pairs.filter(([from]) => !replaced.has(formatVerseKey(toRef(from)))),
      ...overlayPairs,
    ]
  }
  const index: VersificationIndex = {
    lastVerses,
    zeroVerses: new Set(),
    forward: new Map(),
    reverse: new Map(),
  }
  const link = (source: VerseRef, target: VerseRef): void => {
    addTo(index.forward, formatVerseKey(source), target)
    addTo(index.reverse, formatVerseKey(target), source)
  }
  for (const [from, to] of pairs) {
    const source = toRef(from)
    if (source.verse === 0) index.zeroVerses.add(formatVerseKey(source))
    link(source, toRef(to))
  }
  // As in Paratext, a verse no mapping names is the org verse of the same number, even when
  // another verse maps there too (KJV Nehemiah 7:68 and 7:69 are both LSG 7:68).
  if (definition.table !== 'org') {
    const org = indexOf('org')
    for (const [book, chapters] of lastVerses) {
      chapters.forEach((lastVerse, chapterIndex) => {
        for (let verse = 1; verse <= lastVerse; verse++) {
          const ref = { book, chapter: chapterIndex + 1, verse }
          if (!index.forward.has(formatVerseKey(ref)) && existsIn(org, ref)) link(ref, ref)
        }
      })
    }
  }
  return index
}

const indexes = new Map<VersificationId, VersificationIndex>()

const indexOf = (id: VersificationId): VersificationIndex => {
  let index = indexes.get(id)
  if (!index) {
    index = buildIndex(DEFINITIONS[id])
    indexes.set(id, index)
  }
  return index
}

const existsIn = (index: VersificationIndex, ref: VerseRef): boolean => {
  if (![ref.book, ref.chapter, ref.verse].every(Number.isInteger)) return false
  const lastVerse = index.lastVerses.get(ref.book)?.[ref.chapter - 1]
  if (lastVerse === undefined || ref.chapter < 1) return false
  if (ref.verse === 0) return index.zeroVerses.has(formatVerseKey(ref))
  return ref.verse >= 1 && ref.verse <= lastVerse
}

/** Whether the verse exists in the numbering (a verse 0 only where a Psalm title has one). */
export const versificationHasVerse = (id: VersificationId, ref: VerseRef): boolean =>
  existsIn(indexOf(id), ref)

/** The last verse of a chapter, or undefined when the chapter does not exist. */
export const lastVerseOfChapter = (
  id: VersificationId,
  book: number,
  chapter: number
): number | undefined =>
  chapter >= 1 ? indexOf(id).lastVerses.get(book)?.[chapter - 1] : undefined

const pivotTargets = (index: VersificationIndex, ref: VerseRef): VerseRef[] =>
  index.forward.get(formatVerseKey(ref)) ?? []

const pivotSources = (index: VersificationIndex, pivotRef: VerseRef): VerseRef[] =>
  index.reverse.get(formatVerseKey(pivotRef)) ?? []

// Results are fresh objects: a caller may sort or change them without touching the tables.
const none = (): VerseCorrespondence => ({ verses: [], exact: false })

/** The org verses a verse of `id` corresponds to. */
export const toPivot = (id: VersificationId, ref: VerseRef): VerseCorrespondence => {
  const index = indexOf(id)
  if (!existsIn(index, ref)) return none()
  if (id === 'org') return { verses: [{ ...ref }], exact: true }
  const verses = pivotTargets(index, ref)
  return {
    verses: verses.map(verse => ({ ...verse })),
    exact: verses.length === 1 && pivotSources(index, verses[0]).length === 1,
  }
}

/** The verses of `id` an org verse corresponds to. */
export const fromPivot = (id: VersificationId, pivotRef: VerseRef): VerseCorrespondence => {
  if (!existsIn(indexOf('org'), pivotRef)) return none()
  if (id === 'org') return { verses: [{ ...pivotRef }], exact: true }
  const index = indexOf(id)
  const verses = pivotSources(index, pivotRef)
  return {
    verses: verses.map(verse => ({ ...verse })),
    exact: verses.length === 1 && pivotTargets(index, verses[0]).length === 1,
  }
}

/** The verses of `to` a verse of `from` corresponds to, through org. */
export const convertVerse = (
  from: VersificationId,
  to: VersificationId,
  ref: VerseRef
): VerseCorrespondence => {
  const pivot = toPivot(from, ref)
  if (from === to) return pivot.verses.length > 0 ? { verses: [{ ...ref }], exact: true } : none()
  const steps = pivot.verses.map(pivotRef => fromPivot(to, pivotRef))
  const verses: VerseRef[] = []
  for (const step of steps) {
    for (const verse of step.verses) {
      if (!verses.some(existing => compareVerseRefs(existing, verse) === 0)) verses.push(verse)
    }
  }
  verses.sort(compareVerseRefs)
  return {
    verses,
    exact: verses.length === 1 && pivot.exact && steps.every(step => step.exact),
  }
}

/** The verses of a range of one book, in order, verse 0 included where it exists. */
export const versesOfRange = (id: VersificationId, { start, end }: VerseRange): VerseRef[] => {
  if (start.book !== end.book || compareVerseRefs(start, end) > 0) return []
  const verses: VerseRef[] = []
  for (let chapter = start.chapter; chapter <= end.chapter; chapter++) {
    const lastVerse = lastVerseOfChapter(id, start.book, chapter)
    if (lastVerse === undefined) continue
    const first = chapter === start.chapter ? start.verse : 0
    const last = chapter === end.chapter ? Math.min(end.verse, lastVerse) : lastVerse
    for (let verse = first; verse <= last; verse++) {
      const ref = { book: start.book, chapter, verse }
      if (versificationHasVerse(id, ref)) verses.push(ref)
    }
  }
  return verses
}

/**
 * The range of `to` that a range of `from` covers: from its first to its last corresponding
 * verse, in canonical order. Undefined when no verse of the range has an equivalent.
 */
export const convertRange = (
  from: VersificationId,
  to: VersificationId,
  range: VerseRange
): VerseRange | undefined => {
  const verses = versesOfRange(from, range).flatMap(ref => convertVerse(from, to, ref).verses)
  if (verses.length === 0) return undefined
  verses.sort(compareVerseRefs)
  return { start: verses[0], end: verses[verses.length - 1] }
}

let psalmTitleVerses: Set<string> | undefined

/**
 * The org verses that are a Psalm title: those English Bibles number 0 (eng.vrs maps
 * `PSA 51:0` to org 51:1 and 51:2).
 */
const psalmTitles = (): Set<string> => {
  if (!psalmTitleVerses) {
    psalmTitleVerses = new Set(
      tables.paratext.eng.mappings
        .flatMap(expandVrsMapping)
        .filter(([from]) => from[2] === 0)
        .map(([, to]) => formatVerseKey(toRef(to)))
    )
  }
  return psalmTitleVerses
}

/** Whether an org verse is (part of) a Psalm title. */
export const isPsalmTitleVerse = (pivotRef: VerseRef): boolean =>
  psalmTitles().has(formatVerseKey(pivotRef))

/**
 * The org range that identifies a passage read in `id`, for keys shared by every Bible of a
 * language, such as the verse sheet's cache. A Psalm title is left out, whatever the numbering
 * it is read in, so that LSG Psalm 51:1-6 and KJF Psalm 51:1-4 (whose verse 1 holds the title)
 * name the same passage, org 51:3-6. A passage that is only a title keeps it. Undefined when no
 * verse of the range has an equivalent.
 */
export const passageKeyRange = (id: VersificationId, range: VerseRange): VerseRange | undefined => {
  const verses = versesOfRange(id, range).flatMap(ref => toPivot(id, ref).verses)
  const withoutTitles = verses.filter(verse => !isPsalmTitleVerse(verse))
  const kept = withoutTitles.length > 0 ? withoutTitles : verses
  if (kept.length === 0) return undefined
  kept.sort(compareVerseRefs)
  return { start: kept[0], end: kept[kept.length - 1] }
}

// --- Verse keys between a Bible and a resource ---------------------------------------------

/**
 * The keys a verse key read in `from` has in `to`, in canonical order. When either numbering is
 * unknown (undefined), or the table does not know the verse, the key is returned unchanged:
 * that is how every reader worked before conversion. An empty list means the verse has no
 * equivalent in `to`.
 */
export const convertVerseKey = (
  key: string,
  from: VersificationId | undefined,
  to: VersificationId | undefined
): string[] => {
  const ref = parseVerseKey(key)
  if (!ref || !from || !to || from === to || !versificationHasVerse(from, ref)) return [key]
  return convertVerse(from, to, ref).verses.map(formatVerseKey)
}

/**
 * The one verse of `to` that stands for a verse key of `from`, to show or open it: the first
 * corresponding verse, a Psalm title left out when the verse holds more than its title. Same
 * fallbacks as `convertVerseKey`; undefined when the verse has no equivalent.
 */
export const convertVerseKeyToOne = (
  key: string,
  from: VersificationId | undefined,
  to: VersificationId | undefined
): string | undefined => {
  const ref = parseVerseKey(key)
  if (!ref || !from || !to || from === to || !versificationHasVerse(from, ref)) return key
  const pivot = toPivot(from, ref).verses
  const content = pivot.filter(verse => !isPsalmTitleVerse(verse))
  const verses = (content.length > 0 ? content : pivot)
    .flatMap(verse => fromPivot(to, verse).verses)
    .sort(compareVerseRefs)
  return verses.length > 0 ? formatVerseKey(verses[0]) : undefined
}

/** The keys a verse read in a Bible has in a verse-keyed resource (`kind:id`, see above). */
export const bibleVerseKeyInResource = (
  key: string,
  versionId: string,
  resource: string
): string[] =>
  convertVerseKey(key, bibleVersification(versionId), RESOURCE_VERSIFICATIONS[resource])

/** The verse of a Bible that stands for a verse key a resource returned. */
export const resourceVerseKeyInBible = (
  key: string,
  resource: string,
  versionId: string
): string | undefined =>
  convertVerseKeyToOne(key, RESOURCE_VERSIFICATIONS[resource], bibleVersification(versionId))

/** The verse of another Bible that stands for a verse key of a Bible. */
export const bibleVerseKeyInBible = (
  key: string,
  fromVersionId: string,
  toVersionId: string
): string | undefined =>
  convertVerseKeyToOne(key, bibleVersification(fromVersionId), bibleVersification(toVersionId))
