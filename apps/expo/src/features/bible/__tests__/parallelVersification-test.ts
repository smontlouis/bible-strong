import type { ParallelVerse } from '../BibleDOM/BibleDOMWrapper'
import {
  getAlignedRowVerseNumber,
  getParallelCellVerseNumber,
  getParallelChapterRows,
  getParallelVerseState,
  type ParallelChapterRow,
} from '../BibleDOM/verseRenderingModel'
import { getDisplayedParallelVerses, loadBibleReadingParallelVerses } from '../bibleReadingChapter'
import { getParallelPericopeChapter } from '../chapterPericope'
import {
  alignParallelColumn,
  getAlignedVerseKeysOutsideChapter,
  getCompareVerseKeys,
  getParallelColumnChapters,
  getVersionChapterVerseCount,
  withAlignedColumnHighlights,
  withAlignedColumnWordAnnotations,
} from '../parallelVersification'
import type { HighlightsObj, WordAnnotationsObj } from '~redux/modules/user'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))
jest.mock('~features/resources/resourceAccess', () => ({
  defaultResourceAccess: {},
}))

const PSALMS = 19
const GENESIS = 1
const JOEL = 29
const MALACHI = 39

const chapterVerses = (book: number, chapter: number, count: number, version: string) =>
  Array.from({ length: count }, (_, index) => ({
    Livre: book,
    Chapitre: chapter,
    Verset: index + 1,
    Texte: `${version} ${chapter}:${index + 1}`,
  }))

/** A column as the loader builds it: its chapters' verses aligned with the main chapter. */
const alignedColumn = (
  id: string,
  book: number,
  chapter: number,
  mainVersion: string,
  columnChapters: [number, number][]
): ParallelVerse => {
  const aligned = alignParallelColumn({
    book,
    chapter,
    mainVersion,
    columnVersion: id,
    columnVerses: columnChapters.flatMap(([columnChapter, count]) =>
      chapterVerses(book, columnChapter, count, id)
    ),
  })
  if (!aligned) throw new Error('not aligned')
  return { id, verses: aligned.verses, alignment: aligned.alignment }
}

// Each row as `main verse → the column's cell`, the cell as its verses' references
const describeRows = (rows: ParallelChapterRow[]) =>
  Object.fromEntries(
    rows.map(row => {
      const cell = row.rows[1]
      const text = cell.isMissing
        ? '—'
        : cell.isContinued
          ? '(merged)'
          : (cell.verses ?? [cell.verse])
              .map(verse => `${verse.Chapitre}:${verse.Verset}`)
              .join(',')
      return [String(row.verse.Verset), text]
    })
  )

describe('getParallelColumnChapters', () => {
  it('names the chapters of the column that hold the main chapter', () => {
    const chapters = (chapter: number, book: number, mainVersion: string, columnVersion: string) =>
      getParallelColumnChapters({ book, chapter, mainVersion, columnVersion })

    expect(chapters(3, MALACHI, 'LSG', 'KJV')).toEqual([3, 4])
    expect(chapters(3, MALACHI, 'KJV', 'LSG')).toEqual([3])
    expect(chapters(4, MALACHI, 'KJV', 'LSG')).toEqual([3])
    expect(chapters(2, JOEL, 'KJV', 'LSG')).toEqual([2, 3])
    expect(chapters(3, JOEL, 'KJV', 'LSG')).toEqual([4])
    expect(chapters(32, GENESIS, 'LSG', 'KJV')).toEqual([31, 32])
    expect(chapters(51, PSALMS, 'LSG', 'KJV')).toEqual([51])
  })

  it('leaves a column of the same or an unknown numbering to read the same chapter', () => {
    expect(
      getParallelColumnChapters({
        book: MALACHI,
        chapter: 3,
        mainVersion: 'LSG',
        columnVersion: 'NBS',
      })
    ).toBeUndefined()
    expect(
      getParallelColumnChapters({
        book: MALACHI,
        chapter: 3,
        mainVersion: 'LSG',
        columnVersion: 'XYZ',
      })
    ).toBeUndefined()
    expect(
      getParallelColumnChapters({
        book: MALACHI,
        chapter: 3,
        mainVersion: 'XYZ',
        columnVersion: 'KJV',
      })
    ).toBeUndefined()
  })
})

describe('parallel rows aligned through the versification table', () => {
  it('LSG Psalm 51 beside the KJV: the two title verses have no equivalent of their own', () => {
    const rows = getParallelChapterRows(
      chapterVerses(PSALMS, 51, 21, 'LSG'),
      [alignedColumn('KJV', PSALMS, 51, 'LSG', [[51, 19]])],
      'LSG'
    )

    const cells = describeRows(rows)
    expect(rows).toHaveLength(21)
    expect([cells['1'], cells['2'], cells['3'], cells['4'], cells['21']]).toEqual([
      '—',
      '—',
      '51:1',
      '51:2',
      '51:19',
    ])
    expect(rows[0].rows[1]).toMatchObject({ version: 'KJV', isAligned: true, isMissing: true })
    // The verse keeps its own number
    expect(rows[2].rows[1]).toMatchObject({
      verse: { Chapitre: 51, Verset: 1 },
      showsOwnNumber: true,
    })
  })

  it('KJV Psalm 51 beside LSG: the title and the first verse share the row of KJV 51:1', () => {
    const rows = getParallelChapterRows(
      chapterVerses(PSALMS, 51, 19, 'KJV'),
      [alignedColumn('LSG', PSALMS, 51, 'KJV', [[51, 21]])],
      'KJV'
    )

    const cells = describeRows(rows)
    expect(rows).toHaveLength(19)
    expect([cells['1'], cells['2'], cells['19']]).toEqual(['51:1,51:2,51:3', '51:4', '51:21'])
    expect(rows[0].rows[1].verse.Verset).toBe(1)
    expect(rows[0].rows[1].showsOwnNumber).toBe(true)
  })

  it('LSG Malachi 3 beside the KJV: verses 19-24 are KJV Malachi 4:1-6', () => {
    const rows = getParallelChapterRows(
      chapterVerses(MALACHI, 3, 24, 'LSG'),
      [
        alignedColumn('KJV', MALACHI, 3, 'LSG', [
          [3, 18],
          [4, 6],
        ]),
      ],
      'LSG'
    )

    const cells = describeRows(rows)
    expect([cells['1'], cells['18'], cells['19'], cells['24']]).toEqual([
      '3:1',
      '3:18',
      '4:1',
      '4:6',
    ])
    expect(rows[17].rows[1].showsOwnNumber).toBeUndefined()
    expect(rows[18].rows[1].showsOwnNumber).toBe(true)
    expect(getParallelCellVerseNumber(rows[18].rows[1].verse, rows[18].verse)).toBe('4:1')
    expect(getParallelCellVerseNumber(rows[17].rows[1].verse, rows[17].verse)).toBe('18')
  })

  it('KJV Malachi 3 beside LSG keeps LSG 3:19-24 for KJV Malachi 4', () => {
    const column = alignedColumn('LSG', MALACHI, 3, 'KJV', [[3, 24]])
    expect(column.verses).toHaveLength(18)
    expect(
      getParallelChapterRows(chapterVerses(MALACHI, 3, 18, 'KJV'), [column], 'KJV')
    ).toHaveLength(18)

    const nextChapter = alignedColumn('LSG', MALACHI, 4, 'KJV', [[3, 24]])
    expect(
      describeRows(
        getParallelChapterRows(chapterVerses(MALACHI, 4, 6, 'KJV'), [nextChapter], 'KJV')
      )
    ).toEqual({ '1': '3:19', '2': '3:20', '3': '3:21', '4': '3:22', '5': '3:23', '6': '3:24' })
  })

  it('LSG Genesis 32 beside the KJV starts at KJV 31:55', () => {
    const column = alignedColumn('KJV', GENESIS, 32, 'LSG', [
      [31, 55],
      [32, 32],
    ])
    expect(column.verses[0]).toMatchObject({ Chapitre: 31, Verset: 55 })
    expect(column.verses).toHaveLength(33)

    const cells = describeRows(
      getParallelChapterRows(chapterVerses(GENESIS, 32, 33, 'LSG'), [column], 'LSG')
    )
    expect([cells['1'], cells['2'], cells['33']]).toEqual(['31:55', '32:1', '32:32'])
  })

  it('KJV Genesis 31 beside LSG ends with LSG 32:1', () => {
    const column = alignedColumn('LSG', GENESIS, 31, 'KJV', [
      [31, 54],
      [32, 33],
    ])
    const cells = describeRows(
      getParallelChapterRows(chapterVerses(GENESIS, 31, 55, 'KJV'), [column], 'KJV')
    )
    expect([cells['54'], cells['55']]).toEqual(['31:54', '32:1'])
    expect(column.verses).toHaveLength(55)
  })

  it('a column of the original text holds the Psalm title in its verse 0', () => {
    const bhgVerses = [{ Livre: PSALMS, Chapitre: 51, Verset: 0, Texte: 'title' }].concat(
      chapterVerses(PSALMS, 51, 19, 'BHG')
    )
    const aligned = alignParallelColumn({
      book: PSALMS,
      chapter: 51,
      mainVersion: 'LSG',
      columnVersion: 'BHG',
      columnVerses: bhgVerses,
    })
    const cells = describeRows(
      getParallelChapterRows(
        chapterVerses(PSALMS, 51, 21, 'LSG'),
        [{ id: 'BHG', verses: aligned!.verses, alignment: aligned!.alignment }],
        'LSG'
      )
    )
    expect([cells['1'], cells['2'], cells['3']]).toEqual(['51:0', '(merged)', '51:1'])
  })

  it('keeps today’s alignment by number for a column of the same or an unknown numbering', () => {
    const main = chapterVerses(MALACHI, 3, 24, 'LSG')
    const byNumber = [
      { id: 'NBS', verses: chapterVerses(MALACHI, 3, 24, 'NBS') },
      { id: 'XYZ', verses: chapterVerses(MALACHI, 3, 18, 'XYZ') },
    ]
    expect(
      alignParallelColumn({
        book: MALACHI,
        chapter: 3,
        mainVersion: 'LSG',
        columnVersion: 'NBS',
        columnVerses: [],
      })
    ).toBeUndefined()
    const rows = getParallelChapterRows(main, byNumber, 'LSG')
    expect(rows[18].rows.map(cell => cell.verse.Verset)).toEqual([19, 19, 19])
    expect(rows[18].rows[2].isMissing).toBe(true)
    expect(rows[18].rows.some(cell => cell.isAligned)).toBe(false)
  })

  it('aligns each column on its own when numberings are mixed', () => {
    const rows = getParallelChapterRows(
      chapterVerses(MALACHI, 3, 24, 'LSG'),
      [
        { id: 'NBS', verses: chapterVerses(MALACHI, 3, 24, 'NBS') },
        alignedColumn('KJV', MALACHI, 3, 'LSG', [
          [3, 18],
          [4, 6],
        ]),
      ],
      'LSG'
    )
    expect(rows).toHaveLength(24)
    expect(rows[18].rows.map(cell => `${cell.verse.Chapitre}:${cell.verse.Verset}`)).toEqual([
      '3:19',
      '3:19',
      '4:1',
    ])
  })
})

describe('loadBibleReadingParallelVerses across numberings', () => {
  const createResources = () =>
    ({
      bibleContent: {
        loadChapter: jest.fn(async ({ book, chapter, version }) => ({
          success: true,
          data: {
            kind: 'plain',
            verses: chapterVerses(
              book,
              chapter,
              version === 'KJV' ? (chapter === 3 ? 18 : 6) : 24,
              version
            ),
          },
        })),
      },
    }) as unknown as ResourceAccessRegistry

  it('loads the chapters of the column that hold the main chapter and aligns them', async () => {
    const resources = createResources()
    const [kjv, nbs] = await loadBibleReadingParallelVerses(
      {
        book: MALACHI,
        chapter: 3,
        mainVersion: 'LSG',
        parallelColumns: [{ version: 'KJV' }, { version: 'NBS' }],
      },
      resources
    )

    const loadChapter = resources.bibleContent.loadChapter as jest.Mock
    expect(loadChapter.mock.calls.map(([request]) => [request.version, request.chapter])).toEqual([
      ['KJV', 3],
      ['KJV', 4],
      ['NBS', 3],
    ])
    expect(kjv.verses).toHaveLength(24)
    expect(kjv.alignment).toMatchObject({
      book: MALACHI,
      chapter: 3,
      versesByMainVerse: { '19': ['39-4-1'], '24': ['39-4-6'] },
      continuedMainVerses: [],
    })
    expect(nbs).toEqual({
      id: 'NBS',
      verses: chapterVerses(MALACHI, 3, 24, 'NBS'),
      interlinearMode: undefined,
    })
  })

  it('reads the same chapter number without a main version', async () => {
    const resources = createResources()
    const [kjv] = await loadBibleReadingParallelVerses(
      { book: MALACHI, chapter: 3, parallelColumns: [{ version: 'KJV' }] },
      resources
    )
    expect(resources.bibleContent.loadChapter).toHaveBeenCalledTimes(1)
    expect(kjv.alignment).toBeUndefined()
  })

  it('shows an aligned column loaded for the main chapter even when it starts in another one', () => {
    const column = alignedColumn('KJV', GENESIS, 32, 'LSG', [
      [31, 55],
      [32, 32],
    ])
    const [displayed] = getDisplayedParallelVerses({
      columns: [{ version: 'KJV' }],
      loadedVerses: [column],
      isLoadedForChapter: true,
      mainVerses: chapterVerses(GENESIS, 32, 33, 'LSG'),
    })
    expect(displayed).toBe(column)

    const [previousChapter] = getDisplayedParallelVerses({
      columns: [{ version: 'KJV' }],
      loadedVerses: [column],
      isLoadedForChapter: false,
      mainVerses: chapterVerses(GENESIS, 33, 20, 'LSG'),
    })
    expect(previousChapter.isLoading).toBe(true)
  })
})

describe('getParallelPericopeChapter', () => {
  it('gives each row the headings of the column verse opposite it', () => {
    const column = alignedColumn('KJV', MALACHI, 3, 'LSG', [
      [3, 18],
      [4, 6],
    ])
    const pericope = {
      [MALACHI]: { '3': { '1': { h1: 'The messenger' } }, '4': { '1': { h1: 'The day' } } },
    }
    expect(getParallelPericopeChapter(pericope, column)).toEqual({
      '1': { h1: 'The messenger' },
      '19': { h1: 'The day' },
    })
    expect(
      getParallelPericopeChapter(pericope, { verses: chapterVerses(MALACHI, 4, 6, 'KJV') })
    ).toEqual({ '1': { h1: 'The day' } })
  })
})

describe('getCompareVerseKeys', () => {
  it('reads the selected verses in the compared version’s own numbering', () => {
    expect(getCompareVerseKeys(['39-3-19'], 'LSG', 'KJV')).toEqual(['39-4-1'])
    expect(getCompareVerseKeys(['39-3-18', '39-3-19'], 'LSG', 'KJV')).toEqual(['39-3-18', '39-4-1'])
    expect(getCompareVerseKeys(['19-51-3'], 'LSG', 'KJV')).toEqual(['19-51-1'])
    // As in parallel reading, a title verse has no equivalent in a verse that holds more
    expect(getCompareVerseKeys(['19-51-1'], 'LSG', 'KJV')).toEqual([])
    expect(getCompareVerseKeys(['19-51-1', '19-51-2', '19-51-3'], 'LSG', 'KJV')).toEqual([
      '19-51-1',
    ])
    expect(getCompareVerseKeys(['19-51-1'], 'LSG', 'BHG')).toEqual(['19-51-0'])
    expect(getCompareVerseKeys(['19-51-1'], 'KJV', 'LSG')).toEqual([
      '19-51-1',
      '19-51-2',
      '19-51-3',
    ])
    expect(getCompareVerseKeys(['1-32-1'], 'LSG', 'KJV')).toEqual(['1-31-55'])
  })

  it('keeps the keys without a source version, for the same or an unknown numbering', () => {
    expect(getCompareVerseKeys(['39-3-19'], undefined, 'KJV')).toEqual(['39-3-19'])
    expect(getCompareVerseKeys(['39-3-19'], 'LSG', 'NBS')).toEqual(['39-3-19'])
    expect(getCompareVerseKeys(['39-3-19'], 'LSG', 'XYZ')).toEqual(['39-3-19'])
  })

  it('counts a chapter’s verses in the version’s own numbering', () => {
    expect(getVersionChapterVerseCount('KJV', MALACHI, 4)).toBe(6)
    expect(getVersionChapterVerseCount('LSG', MALACHI, 3)).toBe(24)
    expect(getVersionChapterVerseCount('LSG', MALACHI, 4)).toBeUndefined()
    expect(getVersionChapterVerseCount('XYZ', MALACHI, 3)).toBeUndefined()
    expect(getVersionChapterVerseCount(undefined, MALACHI, 3)).toBeUndefined()
  })
})

describe('personal data of aligned parallel columns', () => {
  const ps51 = () => alignedColumn('KJV', PSALMS, 51, 'LSG', [[51, 19]])

  it('marks only the KJV cell of the row of LSG 51:4 for KJV 51:2', () => {
    const rows = getParallelChapterRows(chapterVerses(PSALMS, 51, 21, 'LSG'), [ps51()], 'LSG')
    const highlightedVerses = { '19-51-2': { color: 'color1', date: 1, tags: {} } } as HighlightsObj
    const state = (rowIndex: number, column: number) => {
      const cell = rows[rowIndex].rows[column]
      return getParallelVerseState({
        verse: cell.verse,
        version: cell.version,
        column,
        selectedVerses: { '19-51-2': true },
        selectedVersesVersion: 'KJV',
        highlightedVerses,
        touchedVerse: { verseKey: '19-51-2', version: 'KJV', column: 1 },
        versesWithWordAnnotationsByVersion: new Map([['KJV', new Set(['19-51-2'])]]),
      })
    }

    expect(state(3, 1)).toEqual({
      isSelected: true,
      highlightedColor: 'color1',
      isTouched: true,
      hasWordAnnotations: true,
    })
    // LSG 51:4 holds no such data; the KJV cell of LSG 51:2's row is a gap, which shows no verse
    expect(state(3, 0)).toMatchObject({ isSelected: false, isTouched: false })
    expect(rows[1].rows[1]).toMatchObject({ isAligned: true, isMissing: true })
  })

  it('finds the row of a verse selected in an aligned column', () => {
    const column = ps51()
    expect(getAlignedRowVerseNumber([column], 'KJV', '19-51-2')).toBe(4)
    expect(getAlignedRowVerseNumber([column], 'KJV', '19-51-1')).toBe(3)
    expect(getAlignedRowVerseNumber([column], 'LSG', '19-51-2')).toBeUndefined()
    expect(getAlignedRowVerseNumber([{ id: 'NBS' }], 'NBS', '19-51-2')).toBeUndefined()
  })

  it('brings the highlights and word annotations of the verses shown from another chapter', () => {
    const column = alignedColumn('KJV', MALACHI, 3, 'LSG', [
      [3, 18],
      [4, 6],
    ])
    const outside = getAlignedVerseKeysOutsideChapter([column], MALACHI, 3)
    expect(outside).toEqual({ KJV: ['39-4-1', '39-4-2', '39-4-3', '39-4-4', '39-4-5', '39-4-6'] })

    const chapterHighlights = { '39-3-1': { color: 'a', date: 1, tags: {} } } as HighlightsObj
    const allHighlights = {
      ...chapterHighlights,
      '39-4-1': { color: 'b', date: 2, tags: {} },
      '39-4-7': { color: 'c', date: 3, tags: {} },
    } as HighlightsObj
    expect(
      Object.keys(withAlignedColumnHighlights(chapterHighlights, allHighlights, outside))
    ).toEqual(['39-3-1', '39-4-1'])
    expect(withAlignedColumnHighlights(chapterHighlights, allHighlights, {})).toBe(
      chapterHighlights
    )

    const annotation = (version: string, verseKey: string) => ({
      version,
      color: 'a',
      type: 'background',
      date: 1,
      ranges: [{ verseKey, startWordIndex: 0, endWordIndex: 1, text: 'words' }],
    })
    const annotations = withAlignedColumnWordAnnotations(
      {},
      {
        kjv: annotation('KJV', '39-4-1'),
        lsg: annotation('LSG', '39-4-1'),
      } as unknown as WordAnnotationsObj,
      outside
    )
    expect(Object.keys(annotations)).toEqual(['kjv'])
    expect(annotations.kjv.ranges[0].text).toBe('')
  })
})
