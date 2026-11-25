import type { BibleAudioRecording } from './audioCatalog'

const OLD_TESTAMENT = { first: 1, last: 39 }
const NEW_TESTAMENT = { first: 40, last: 66 }
/** Beyond this many books, a partial recording is told by its count. */
const NAMED_BOOKS = 3

/**
 * What part of the Bible a recording covers, to say it in the list of recordings: nothing to say
 * for the whole Bible, a testament when it is exactly one, its books by name when they are few,
 * else their count.
 */
export type RecordingCoverage =
  | { kind: 'all' }
  | { kind: 'testament'; testament: 'old' | 'new' }
  | { kind: 'books'; books: number[] }
  | { kind: 'count'; count: number }

const isRange = (books: number[], { first, last }: { first: number; last: number }) =>
  books.length === last - first + 1 && books.every(book => book >= first && book <= last)

export const getRecordingCoverage = (recording: BibleAudioRecording): RecordingCoverage => {
  if (!recording.books) return { kind: 'all' }
  const books = [...new Set(recording.books)].sort((a, b) => a - b)
  if (isRange(books, OLD_TESTAMENT)) return { kind: 'testament', testament: 'old' }
  if (isRange(books, NEW_TESTAMENT)) return { kind: 'testament', testament: 'new' }
  if (books.length <= NAMED_BOOKS) return { kind: 'books', books }
  return { kind: 'count', count: books.length }
}
