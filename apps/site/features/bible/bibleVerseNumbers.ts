import type {
  BibleChapterDto,
  BibleVerseTextsDto,
  BibleVersionCoverageDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import { readResource } from '../resources/resourceApi'

export type BibleChapterVerses = { book: number; chapter: number; verses: number[] }

/**
 * The coverage of a version. It counts the verses of a chapter without numbering them.
 * `verseNumbersByBookChapter` is not published yet: a Resource service that gives there the
 * numbers of the chapters not numbered from 1 to their count spares every other read here.
 */
type Coverage = BibleVersionCoverageDto & {
  verseNumbersByBookChapter?: Record<string, readonly number[]>
}

// The Resource API reads at most 200 verses at once, none numbered above 200.
const PROBE_BATCH_SIZE = 200
const MAX_VERSE_NUMBER = 200
/** How many numbers past the count of a chapter are asked for, to see whether it skips any. */
const PROBE_SPAN = 3
// A sitemap is read by one crawler at a time: a few reads at once spare the API.
const CONCURRENT_READS = 6

const chapterKey = (book: number, chapter: number): string => `${book}-${chapter}`

const inBatches = async <Item, Result>(
  items: readonly Item[],
  size: number,
  run: (item: Item) => Promise<Result>
): Promise<Result[]> => {
  const results: Result[] = []
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(run))))
  }
  return results
}

type CountedChapter = { book: number; chapter: number; count: number }

const countedChapters = (coverage: Coverage): CountedChapter[] => {
  const covered = new Set(coverage.books)
  return coverage.canon.orderedBooks
    .filter(book => covered.has(book))
    .flatMap(book =>
      (coverage.chaptersByBook[String(book)] ?? []).map(chapter => ({
        book,
        chapter,
        count: coverage.verseCountByBookChapter[chapterKey(book, chapter)] ?? 0,
      }))
    )
    .filter(({ count }) => count > 0)
}

/**
 * The verse keys that tell whether a chapter of `count` verses is numbered from 1 to its
 * count: its last number must exist and the following ones must not. A chapter that leaves
 * a number out (a verse its manuscripts do not have, verses translated as one) fails one
 * of the two.
 */
export const verseProbeKeys = ({ book, chapter, count }: CountedChapter): string[] =>
  Array.from({ length: PROBE_SPAN + 1 }, (_, offset) => count + offset)
    .filter(verse => verse <= MAX_VERSE_NUMBER)
    .map(verse => `${book}-${chapter}-${verse}`)

/**
 * Whether the probed numbers of a chapter are those of a chapter numbered 1 to `count`.
 * This is a strong sign, not a proof: a chapter that skips numbers before its count and
 * resumes more than `PROBE_SPAN` numbers after it answers the same.
 */
export const isNumberedToCount = (count: number, probed: readonly number[]): boolean =>
  probed.length === 1 && probed[0] === count

const sequence = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1)

/** The chapters whose numbering has to be read, since their count does not describe it. */
const findSkippingChapters = async (
  versionId: string,
  chapters: readonly CountedChapter[]
): Promise<Set<string>> => {
  const keys = chapters.flatMap(verseProbeKeys)
  const batches = Array.from({ length: Math.ceil(keys.length / PROBE_BATCH_SIZE) }, (_, index) =>
    keys.slice(index * PROBE_BATCH_SIZE, (index + 1) * PROBE_BATCH_SIZE)
  )
  const probed = new Map<string, number[]>()
  const answers = await inBatches(batches, CONCURRENT_READS, references =>
    readResource<BibleVerseTextsDto>(`/v1/bibles/${versionId}/verses`, {
      references: references.join(','),
    })
  )
  for (const verse of answers.flatMap(answer => answer?.verses ?? [])) {
    const key = chapterKey(verse.book, verse.chapter)
    probed.set(key, [...(probed.get(key) ?? []), verse.number])
  }
  return new Set(
    chapters
      .filter(({ book, chapter, count }) => {
        return !isNumberedToCount(count, probed.get(chapterKey(book, chapter)) ?? [])
      })
      .map(({ book, chapter }) => chapterKey(book, chapter))
  )
}

/**
 * The verse numbers of every chapter of a version, in canon order, as the Resource API
 * publishes them. Numbering differs between Bibles and a Bible may skip numbers, so the
 * numbers are those of the version itself: its coverage counts the verses of each chapter,
 * the last numbers of each chapter tell the few that are not numbered 1 to their count, and
 * those chapters are read. A version that is not published has no chapters.
 */
export const listBibleVerseNumbers = async (versionId: string): Promise<BibleChapterVerses[]> => {
  const coverage = await readResource<Coverage>(`/v1/bibles/${versionId}/coverage`)
  if (!coverage) return []
  const chapters = countedChapters(coverage)

  const published = coverage.verseNumbersByBookChapter
  if (published) {
    return chapters.map(({ book, chapter, count }) => ({
      book,
      chapter,
      verses: [...(published[chapterKey(book, chapter)] ?? sequence(count))],
    }))
  }

  const skipping = await findSkippingChapters(versionId, chapters)
  const read = new Map(
    await inBatches(
      chapters.filter(({ book, chapter }) => skipping.has(chapterKey(book, chapter))),
      CONCURRENT_READS,
      async ({ book, chapter }) => {
        const text = await readResource<BibleChapterDto>(
          `/v1/bibles/${versionId}/books/${book}/chapters/${chapter}`
        )
        const numbers = (text?.verses ?? []).map(verse => verse.number).filter(verse => verse > 0)
        return [chapterKey(book, chapter), numbers.sort((left, right) => left - right)] as const
      }
    )
  )
  return chapters.map(({ book, chapter, count }) => ({
    book,
    chapter,
    verses: read.get(chapterKey(book, chapter)) ?? sequence(count),
  }))
}
