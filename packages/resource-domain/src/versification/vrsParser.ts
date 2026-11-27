/**
 * Reads the Paratext `.vrs` grammar: book lines giving the last verse of each chapter, and
 * mapping lines `BOOK c:v[-v] = BOOK c:v[-v]` from the versification to `org`. Lines starting
 * with `#!` are read as mappings (Paratext 7.3 and later); a leading `&` marks a range mapped
 * onto one verse. A verse mapped to a book outside the 66, or to nothing (`DAN 3:24-90 =`, a
 * Bible Strong extension), has no equivalent. Other comments, excluded verses (`-`) and verse segments (`*`) are ignored:
 * none of the tables read here use them.
 *
 * Only the 66 books of the Protestant canon are read; other books are skipped.
 */

export const VRS_BOOK_CODES = [
  'GEN',
  'EXO',
  'LEV',
  'NUM',
  'DEU',
  'JOS',
  'JDG',
  'RUT',
  '1SA',
  '2SA',
  '1KI',
  '2KI',
  '1CH',
  '2CH',
  'EZR',
  'NEH',
  'EST',
  'JOB',
  'PSA',
  'PRO',
  'ECC',
  'SNG',
  'ISA',
  'JER',
  'LAM',
  'EZK',
  'DAN',
  'HOS',
  'JOL',
  'AMO',
  'OBA',
  'JON',
  'MIC',
  'NAM',
  'HAB',
  'ZEP',
  'HAG',
  'ZEC',
  'MAL',
  'MAT',
  'MRK',
  'LUK',
  'JHN',
  'ACT',
  'ROM',
  '1CO',
  '2CO',
  'GAL',
  'EPH',
  'PHP',
  'COL',
  '1TH',
  '2TH',
  '1TI',
  '2TI',
  'TIT',
  'PHM',
  'HEB',
  'JAS',
  '1PE',
  '2PE',
  '1JN',
  '2JN',
  '3JN',
  'JUD',
  'REV',
] as const

/** `[book, chapter, firstVerse, lastVerse]`, the book numbered 1 to 66. */
export type VrsRange = readonly [number, number, number, number]

/** A mapping line, from the versification (left) to `org` (right). */
export type VrsMapping = readonly [from: VrsRange, to: VrsRange]

/** `[book, chapter, lastVerse]`. */
export type VrsChapter = readonly [number, number, number]

export interface VrsTable {
  chapters: VrsChapter[]
  mappings: VrsMapping[]
  /**
   * Verses with no equivalent among the 66 books: a line mapping them to another book (Vulgate
   * Daniel 3:24-90 to the Song of the Three, `S3Y`), or a Bible Strong line with nothing on the
   * right (`DAN 3:24-90 =`). Listed only when there are some.
   */
  unmapped?: VrsRange[]
}

export interface VrsParseOptions {
  /**
   * An overlay lists only the chapters it changes: its book lines are read as `c:v` pairs for
   * any chapters, not as every chapter from 1. `c:0` takes a chapter of the base away.
   */
  overlay?: boolean
}

const bookNumber = (code: string): number | undefined => {
  const index = (VRS_BOOK_CODES as readonly string[]).indexOf(code)
  return index < 0 ? undefined : index + 1
}

const RANGE = /^([1-3A-Z][A-Z0-9]{2}) (\d+):(\d+)(?:-(\d+))?$/

const parseRange = (text: string, line: number): VrsRange | undefined => {
  // A book outside the 66 may use verse segments (`ESG 1:1a`): it is skipped before the
  // strict reading.
  const book = bookNumber(text.trim().split(/\s+/)[0])
  if (book === undefined) return undefined
  const match = RANGE.exec(text.trim())
  if (!match) throw new Error(`vrs-range-unreadable:${line}:${text}`)
  const first = Number(match[3])
  const last = match[4] === undefined ? first : Number(match[4])
  if (last < first) throw new Error(`vrs-range-reversed:${line}:${text}`)
  return [book, Number(match[2]), first, last]
}

const length = (range: VrsRange): number => range[3] - range[2] + 1

export const parseVrs = (source: string, options: VrsParseOptions = {}): VrsTable => {
  const chapters: VrsChapter[] = []
  const mappings: VrsMapping[] = []
  const unmapped: VrsRange[] = []
  source.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1
    let line = raw.trim()
    if (line.startsWith('#!')) line = line.slice(2)
    else if (line.startsWith('#')) return
    line = line.split('#')[0].trim()
    if (line === '' || line.startsWith('-') || line.startsWith('*')) return
    let manyToOne = false
    if (line.startsWith('&')) {
      manyToOne = true
      line = line.slice(1).trim()
    }
    if (line.includes('=')) {
      const [left, right, ...rest] = line.split('=')
      if (rest.length > 0) throw new Error(`vrs-mapping-unreadable:${lineNumber}:${raw}`)
      const from = parseRange(left, lineNumber)
      const to = parseRange(right, lineNumber)
      if (!from) return
      if (!to) {
        unmapped.push(from)
        return
      }
      if (length(from) !== length(to) && length(from) !== 1 && length(to) !== 1) {
        throw new Error(`vrs-mapping-lengths:${lineNumber}:${raw}`)
      }
      if (manyToOne && length(to) !== 1) throw new Error(`vrs-many-to-one:${lineNumber}:${raw}`)
      mappings.push([from, to])
      return
    }
    const [code, ...entries] = line.split(/\s+/)
    const book = bookNumber(code)
    if (book === undefined) return
    entries.forEach((entry, position) => {
      const match = /^(\d+):(\d+)$/.exec(entry)
      if (!match || (!options.overlay && Number(match[1]) !== position + 1)) {
        throw new Error(`vrs-book-line-unreadable:${lineNumber}:${raw}`)
      }
      chapters.push([book, Number(match[1]), Number(match[2])])
    })
  })
  return unmapped.length > 0 ? { chapters, mappings, unmapped } : { chapters, mappings }
}

export type VrsVerse = readonly [number, number, number]

/**
 * The verse pairs a mapping line stands for. Ranges of equal length pair verse by verse; a
 * single verse on one side pairs with every verse of the other.
 */
export const expandVrsMapping = ([from, to]: VrsMapping): Array<readonly [VrsVerse, VrsVerse]> => {
  const pairs: Array<readonly [VrsVerse, VrsVerse]> = []
  const fromLength = length(from)
  const toLength = length(to)
  for (let offset = 0; offset < Math.max(fromLength, toLength); offset++) {
    pairs.push([
      [from[0], from[1], fromLength === 1 ? from[2] : from[2] + offset],
      [to[0], to[1], toLength === 1 ? to[2] : to[2] + offset],
    ])
  }
  return pairs
}
