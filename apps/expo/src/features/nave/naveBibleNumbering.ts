import {
  bibleVersification,
  compareVerseRefs,
  convertRange,
  convertVerseKeyToOne,
  lastVerseOfChapter,
  parseVerseKey,
  RESOURCE_VERSIFICATIONS,
  versesOfRange,
  type VerseRef,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import verseToReference from '~helpers/verseToReference'

/** A chapter, or the verses of that chapter a topic cites: the target of a `v=` link. */
export type NaveVerseTarget = { book: number; chapter: number; verses: number[] }

type Numberings = { from: VersificationId; to: VersificationId }

/**
 * The numbering a topic's verse links are written in and the one of the Bible they open in;
 * undefined when either is unknown or both are the same, and links are left as they are.
 */
const numberingsOf = (language: string, versionId: string): Numberings | undefined => {
  const from = RESOURCE_VERSIFICATIONS[`nave:${language}`]
  const to = bibleVersification(versionId)
  return from && to && from !== to ? { from, to } : undefined
}

/** `book-chapter` for a whole chapter, or `book-chapter-verse,verse,…`. */
export const parseNaveVerseTarget = (target: string): NaveVerseTarget | undefined => {
  const match = /^(\d+)-(\d+)(?:-(\d+(?:,\d+)*))?$/u.exec(target.trim())
  if (!match) return undefined
  return {
    book: Number(match[1]),
    chapter: Number(match[2]),
    verses: match[3]?.split(',').map(Number) ?? [],
  }
}

export const formatNaveVerseTarget = ({ book, chapter, verses }: NaveVerseTarget): string =>
  verses.length ? `${book}-${chapter}-${verses.join(',')}` : `${book}-${chapter}`

/** Groups cited verses into runs of consecutive numbers, keeping their order. */
const runsOf = (verses: readonly number[]): { start: number; end: number }[] => {
  const runs: { start: number; end: number }[] = []
  for (const verse of verses) {
    const last = runs.at(-1)
    if (last && verse === last.end + 1) last.end = verse
    else runs.push({ start: verse, end: verse })
  }
  return runs
}

/**
 * The verses of `to` a run of verses of `from` covers. A run opens at the verse that stands
 * for its first one, a Psalm title left out (Nave Ps 51:1-2 is LSG 51:3-4); a whole chapter
 * keeps everything it covers. Undefined when no verse of the run is in the numbering's table,
 * and the run is then kept as written.
 */
const convertRun = (
  { from, to }: Numberings,
  book: number,
  chapter: number,
  { start, end }: { start: number; end: number },
  wholeChapter: boolean
): VerseRef[] | undefined => {
  const source = { start: { book, chapter, verse: start }, end: { book, chapter, verse: end } }
  if (!versesOfRange(from, source).length) return undefined
  const range = convertRange(from, to, source)
  if (!range) return []
  const first = wholeChapter
    ? undefined
    : parseVerseKey(convertVerseKeyToOne(`${book}-${chapter}-${start}`, from, to) ?? '')
  const opening =
    first && compareVerseRefs(first, range.start) > 0 && compareVerseRefs(first, range.end) <= 0
      ? first
      : range.start
  return versesOfRange(to, { start: opening, end: range.end })
}

/**
 * A verse link of a Nave topic in the numbering of the Bible it opens in: one target per
 * chapter it falls in (KJV Numbers 16:36-50 is LSG 17:1-15), none when no cited verse has an
 * equivalent there. A whole chapter stays one when its verses fill a chapter of the Bible
 * (Nave Joel 3 is LSG Joel 4), else it becomes the verses it covers (Nave Malachi 4 is LSG
 * Malachi 3:19-24).
 */
export const naveTargetInBible = (
  target: NaveVerseTarget,
  language: string,
  versionId: string
): NaveVerseTarget[] => {
  const numberings = numberingsOf(language, versionId)
  if (!numberings) return [target]
  const { book, chapter, verses } = target
  const wholeChapter = verses.length === 0
  const runs = wholeChapter
    ? [{ start: 1, end: lastVerseOfChapter(numberings.from, book, chapter) ?? 1 }]
    : runsOf(verses)

  const byChapter = new Map<number, number[]>()
  const add = (refChapter: number, verse?: number) => {
    const list = byChapter.get(refChapter) ?? []
    if (verse !== undefined && !list.includes(verse)) list.push(verse)
    byChapter.set(refChapter, list)
  }
  for (const run of runs) {
    const converted = convertRun(numberings, book, chapter, run, wholeChapter)
    if (!converted) {
      // A verse the table does not know is read as written, as before conversion.
      if (wholeChapter) add(chapter)
      else for (let verse = run.start; verse <= run.end; verse++) add(chapter, verse)
      continue
    }
    for (const ref of converted) add(ref.chapter, ref.verse)
  }

  return [...byChapter].map(([refChapter, list]) => {
    const last = lastVerseOfChapter(numberings.to, book, refChapter)
    const fillsChapter =
      wholeChapter &&
      (list.length === 0 ||
        (last !== undefined &&
          Array.from({ length: last }, (_, index) => index + 1).every(verse =>
            list.includes(verse)
          )))
    return { book, chapter: refChapter, verses: fillsChapter ? [] : list }
  })
}

const sameTargets = (left: NaveVerseTarget[], right: NaveVerseTarget) =>
  left.length === 1 && formatNaveVerseTarget(left[0]) === formatNaveVerseTarget(right)

const VERSE_LINK_PATTERN =
  /<a\b([^>]*?)\bhref\s*=\s*(["'])v=([^"']*)\2([^>]*)>([\s\S]*?)<\/a\s*>/giu

/**
 * A topic's HTML with its verse links in the numbering of the Bible they open in, so that the
 * link, its label and the verse preview all name the verse that Bible reads (Nave Malachi 4:5
 * is LSG Malachi 3:23). A link whose target does not change is kept as written; a changed one
 * is relabelled with the French book names both publications print; a link to verses without
 * an equivalent keeps its text, unlinked.
 */
export const naveHtmlInBible = (html: string, language: string, versionId: string): string => {
  if (!numberingsOf(language, versionId)) return html
  return html.replace(
    VERSE_LINK_PATTERN,
    (link, before: string, quote: string, value: string, after: string, label: string) => {
      const target = parseNaveVerseTarget(value)
      if (!target) return link
      const converted = naveTargetInBible(target, language, versionId)
      if (sameTargets(converted, target)) return link
      if (!converted.length) return label
      return converted
        .map(
          ref =>
            `<a${before}href=${quote}v=${formatNaveVerseTarget(ref)}${quote}${after}>${verseToReference(
              { bookNum: ref.book, chapterNum: ref.chapter, verses: ref.verses },
              { language: 'fr' }
            )}</a>`
        )
        .join('; ')
    }
  )
}
