import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import coverage from './fixtures/bibleCoverageLastVerses.json'
import {
  BIBLE_VERSIFICATIONS,
  convertRange,
  convertVerse,
  fromPivot,
  bibleVerseKeyInBible,
  bibleVerseKeyInResource,
  convertVerseKeyToOne,
  lastVerseOfChapter,
  resourceVerseKeyInBible,
  passageKeyRange,
  toPivot,
  VERSIFICATION_IDS,
  versificationHasVerse,
  type VersificationId,
  type VerseRef,
} from './versification'
import compiledTables from './versification/tables.json'
import { readVersificationSources } from './versification/versificationSources'

const here = path.dirname(fileURLToPath(import.meta.url))

const v = (book: number, chapter: number, verse: number): VerseRef => ({ book, chapter, verse })

const PSALMS = 19

describe('versification tables', () => {
  test('tables.json is compiled from the .vrs sources', async () => {
    const sources = await readVersificationSources(file =>
      readFile(path.join(here, 'versification', file), 'utf8')
    )
    assert.deepEqual(
      JSON.parse(JSON.stringify(sources)),
      compiledTables,
      'run yarn workspace @bible-strong/resource-domain versification:tables'
    )
  })
})

describe('verse keys between Bibles and resources', () => {
  test('an LSG reader reads the Trésor at the KJV verse, and its targets come back in LSG', () => {
    assert.deepEqual(bibleVerseKeyInResource('19-51-3', 'LSG', 'cross-references:TRESOR'), [
      '19-51-1',
    ])
    assert.deepEqual(bibleVerseKeyInResource('39-3-23', 'LSG', 'cross-references:TRESOR'), [
      '39-4-5',
    ])
    assert.deepEqual(bibleVerseKeyInResource('47-13-12', 'LSG', 'cross-references:TRESOR'), [
      '47-13-12',
      '47-13-13',
    ])
    assert.equal(resourceVerseKeyInBible('19-38-18', 'cross-references:TRESOR', 'LSG'), '19-38-19')
    assert.equal(resourceVerseKeyInBible('19-51-1', 'cross-references:TRESOR', 'LSG'), '19-51-3')
    assert.equal(resourceVerseKeyInBible('19-51-1', 'cross-references:TRESOR', 'KJF'), '19-51-1')
  })

  test('a Bible or resource without a known numbering keeps its keys', () => {
    assert.deepEqual(bibleVerseKeyInResource('19-51-3', 'UNKNOWN', 'cross-references:TRESOR'), [
      '19-51-3',
    ])
    assert.deepEqual(bibleVerseKeyInResource('19-51-3', 'LSG', 'commentary:aquifer-fr'), [
      '19-51-3',
    ])
    assert.equal(convertVerseKeyToOne('not-a-key', 'org', 'bs-kjv'), 'not-a-key')
  })

  test('the same verse in another Bible', () => {
    assert.equal(bibleVerseKeyInBible('19-51-3', 'KJF', 'LSG'), '19-51-5')
    assert.equal(bibleVerseKeyInBible('19-51-3', 'LSG', 'KJV'), '19-51-1')
    assert.equal(bibleVerseKeyInBible('19-51-3', 'LSG', 'BHG'), '19-51-1')
    assert.equal(bibleVerseKeyInBible('19-51-1', 'LSG', 'KJV'), '19-51-1')
  })
})

describe('the key of a passage', () => {
  test('a Psalm title is left out, whatever the numbering', () => {
    const expected = { start: v(PSALMS, 51, 3), end: v(PSALMS, 51, 6) }
    assert.deepEqual(
      passageKeyRange('org', { start: v(PSALMS, 51, 1), end: v(PSALMS, 51, 6) }),
      expected
    )
    assert.deepEqual(
      passageKeyRange('org', { start: v(PSALMS, 51, 3), end: v(PSALMS, 51, 6) }),
      expected
    )
    assert.deepEqual(
      passageKeyRange('bs-kjv', { start: v(PSALMS, 51, 1), end: v(PSALMS, 51, 4) }),
      expected
    )
    assert.deepEqual(
      passageKeyRange('bs-nrsv', { start: v(PSALMS, 51, 0), end: v(PSALMS, 51, 4) }),
      expected
    )
  })

  test('a passage that is only a title keeps it', () => {
    assert.deepEqual(passageKeyRange('org', { start: v(PSALMS, 51, 1), end: v(PSALMS, 51, 2) }), {
      start: v(PSALMS, 51, 1),
      end: v(PSALMS, 51, 2),
    })
  })

  test('a passage that changes chapter keeps one org range', () => {
    assert.deepEqual(passageKeyRange('bs-kjv', { start: v(39, 4, 1), end: v(39, 4, 6) }), {
      start: v(39, 3, 19),
      end: v(39, 3, 24),
    })
  })
})

describe('conversions checked against the published texts', () => {
  test('a Psalm title is verse 1-2 in LSG, part of verse 1 in the KJV, verse 0 in BHG', () => {
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(PSALMS, 51, 3)), {
      verses: [v(PSALMS, 51, 1)],
      exact: false,
    })
    assert.deepEqual(toPivot('bs-kjv', v(PSALMS, 51, 1)).verses, [
      v(PSALMS, 51, 1),
      v(PSALMS, 51, 2),
      v(PSALMS, 51, 3),
    ])
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(PSALMS, 51, 5)), {
      verses: [v(PSALMS, 51, 3)],
      exact: true,
    })
    assert.deepEqual(toPivot('bs-nrsv', v(PSALMS, 51, 0)).verses, [
      v(PSALMS, 51, 1),
      v(PSALMS, 51, 2),
    ])
    assert.equal(versificationHasVerse('bs-kjv', v(PSALMS, 51, 0)), false)
    assert.equal(versificationHasVerse('bs-nrsv', v(PSALMS, 51, 0)), true)
  })

  test('Malachi, Joel and Genesis 32 change chapter', () => {
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(39, 3, 23)).verses, [v(39, 4, 5)])
    assert.deepEqual(convertVerse('bs-kjv', 'org', v(29, 2, 28)).verses, [v(29, 3, 1)])
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(29, 4, 1)).verses, [v(29, 3, 1)])
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(1, 32, 1)).verses, [v(1, 31, 55)])
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(1, 32, 2)).verses, [v(1, 32, 1)])
    assert.equal(lastVerseOfChapter('org', 39, 4), undefined)
    assert.equal(lastVerseOfChapter('bs-kjv', 29, 4), undefined)
  })

  test('the New Testament differences of the KJV and the NRSV', () => {
    // 3 John 15 and Revelation 12:18 exist in LSG and BHG, not in the KJV.
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(64, 1, 15)), {
      verses: [v(64, 1, 14)],
      exact: false,
    })
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(66, 12, 18)).verses, [v(66, 13, 1)])
    assert.deepEqual(convertVerse('org', 'bs-nrsv', v(66, 12, 18)), {
      verses: [v(66, 12, 18)],
      exact: true,
    })
    // 2 Corinthians 13: LSG 13:12 is KJV 13:12-13; LSG 13:13 is KJV 13:14.
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(47, 13, 12)).verses, [
      v(47, 13, 12),
      v(47, 13, 13),
    ])
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(47, 13, 13)).verses, [v(47, 13, 14)])
    assert.deepEqual(convertVerse('org', 'bs-nrsv', v(47, 13, 13)).verses, [v(47, 13, 13)])
    // Acts 19:40-41 of the English Bibles is one verse in org.
    assert.deepEqual(convertVerse('bs-kjv', 'org', v(44, 19, 41)).verses, [v(44, 19, 40)])
  })

  test('the French Protestant Bibles', () => {
    // Job 39:1 of NEG79, OST and FMAR ("Chasses-tu la proie pour la lionne…") is LSG 38:39.
    for (const id of ['bs-neg79', 'bs-ost', 'bs-fmar'] as const) {
      assert.deepEqual(toPivot(id, v(18, 39, 1)).verses, [v(18, 38, 39)])
      assert.deepEqual(toPivot(id, v(21, 12, 1)).verses, [v(21, 11, 9)])
    }
    // NEG79 numbers the Psalms as LSG, and Genesis 32 as the KJV.
    assert.deepEqual(convertVerse('bs-neg79', 'org', v(PSALMS, 51, 3)).verses, [v(PSALMS, 51, 3)])
    assert.deepEqual(convertVerse('bs-neg79', 'bs-kjv', v(1, 32, 1)).verses, [v(1, 32, 1)])
    assert.equal(lastVerseOfChapter('bs-neg79', 29, 4), undefined)
    // OST and FMAR open Numbers 13 with LSG 12:16; FMAR puts some Psalm titles in verse 1.
    assert.deepEqual(toPivot('bs-ost', v(4, 13, 1)).verses, [v(4, 12, 16)])
    assert.deepEqual(toPivot('bs-fmar', v(PSALMS, 102, 1)).verses, [
      v(PSALMS, 102, 1),
      v(PSALMS, 102, 2),
    ])
    assert.deepEqual(toPivot('bs-fmar', v(40, 11, 2)).verses, [v(40, 11, 2)])
    assert.deepEqual(toPivot('bs-ost', v(40, 11, 2)).verses, [v(40, 11, 2), v(40, 11, 3)])
    // Lausanne follows the KJV, but Joel in 4 chapters and Mark 9:50 in two verses.
    assert.deepEqual(convertVerse('bs-lau', 'org', v(29, 3, 1)).verses, [v(29, 3, 1)])
    assert.deepEqual(convertVerse('bs-lau', 'org', v(29, 4, 21)).verses, [v(29, 4, 21)])
    assert.deepEqual(convertVerse('bs-lau', 'org', v(41, 9, 51)).verses, [v(41, 9, 50)])
    assert.deepEqual(convertVerse('bs-lau', 'org', v(PSALMS, 51, 1)).verses, [
      v(PSALMS, 51, 1),
      v(PSALMS, 51, 2),
      v(PSALMS, 51, 3),
    ])
    assert.equal(bibleVerseKeyInBible('29-3-1', 'LAU', 'KJV'), '29-2-28')
  })

  test('the modern English Bibles and the rows that stand for several verses', () => {
    // Revelation 12:18 is the end of ESV 12:17, and the start of NIV 13:1.
    assert.deepEqual(toPivot('bs-esv', v(66, 12, 17)).verses, [v(66, 12, 17), v(66, 12, 18)])
    assert.deepEqual(toPivot('bs-niv', v(66, 13, 1)).verses, [v(66, 12, 18), v(66, 13, 1)])
    assert.deepEqual(toPivot('bs-csb', v(47, 13, 13)).verses, [v(47, 13, 13)])
    // BFC 1 Chronicles 25:9 is verses 9-31, and LSG 25:20 is read there.
    assert.equal(toPivot('bs-bfc', v(13, 25, 9)).verses.length, 23)
    assert.equal(lastVerseOfChapter('bs-bfc', 13, 25), 9)
    assert.equal(bibleVerseKeyInBible('13-25-20', 'LSG', 'FRC97'), '13-25-9')
    assert.equal(bibleVerseKeyInBible('19-136-7', 'NIV', 'EASY'), '19-136-4')
    // TLV Deuteronomy 5:17 holds four commandments.
    assert.deepEqual(convertVerse('bs-tlv', 'org', v(5, 5, 18)).verses, [v(5, 5, 21)])
  })

  test('the Vulgate, the Septuagint and Crampon, books 1-66 only', () => {
    const VUL = 'clementine-vulgate'
    const LXX = 'theotex-septuagint'
    // Psalms 9-10 are one psalm: Vulgate and Septuagint 9:22 is LSG 10:1.
    assert.deepEqual(toPivot(VUL, v(PSALMS, 9, 22)).verses, [v(PSALMS, 10, 1)])
    assert.deepEqual(toPivot(LXX, v(PSALMS, 113, 9)).verses, [v(PSALMS, 115, 1)])
    assert.deepEqual(toPivot(VUL, v(PSALMS, 147, 1)).verses, [v(PSALMS, 147, 12)])
    // The Septuagint orders Jeremiah as the Greek: LXX 26:2 is LSG 46:2.
    assert.deepEqual(toPivot(LXX, v(24, 26, 2)).verses, [v(24, 46, 2)])
    assert.deepEqual(toPivot(LXX, v(16, 1, 1)).verses, [v(16, 1, 1)])
    // Additions have no equivalent.
    assert.deepEqual(toPivot(VUL, v(27, 3, 50)), { verses: [], exact: false })
    assert.deepEqual(toPivot(LXX, v(27, 13, 1)), { verses: [], exact: false })
    assert.deepEqual(convertVerse(VUL, 'org', v(27, 3, 91)).verses, [v(27, 3, 24)])
    assert.deepEqual(toPivot('bible-strong-catholic-extended-esther-daniel', v(17, 11, 2)), {
      verses: [],
      exact: false,
    })
    assert.equal(bibleVerseKeyInBible('41-9-1', 'LSG', 'BCC1923'), '41-8-39')
    assert.equal(bibleVerseKeyInBible('29-3-1', 'LSG', 'VUL'), '29-2-28')
  })

  test('a verse that does not exist has no correspondence', () => {
    assert.deepEqual(toPivot('bs-kjv', v(39, 4, 7)), { verses: [], exact: false })
    assert.deepEqual(fromPivot('bs-kjv', v(39, 4, 1)), { verses: [], exact: false })
    assert.deepEqual(convertVerse('org', 'bs-kjv', v(67, 1, 1)), { verses: [], exact: false })
  })

  test('a passage gets one org range whatever the numbering it is read in', () => {
    assert.deepEqual(
      convertRange('bs-kjv', 'org', { start: v(PSALMS, 51, 1), end: v(PSALMS, 51, 4) }),
      convertRange('org', 'org', { start: v(PSALMS, 51, 1), end: v(PSALMS, 51, 6) })
    )
    assert.deepEqual(convertRange('bs-kjv', 'org', { start: v(39, 4, 1), end: v(39, 4, 6) }), {
      start: v(39, 3, 19),
      end: v(39, 3, 24),
    })
    // A KJV range across Joel 2-3 is one org chapter.
    assert.deepEqual(convertRange('bs-kjv', 'org', { start: v(29, 2, 30), end: v(29, 3, 2) }), {
      start: v(29, 3, 3),
      end: v(29, 4, 2),
    })
  })
})

const allVerses = (id: VersificationId): VerseRef[] => {
  const verses: VerseRef[] = []
  for (let book = 1; book <= 66; book++) {
    for (let chapter = 1; lastVerseOfChapter(id, book, chapter) !== undefined; chapter++) {
      const last = lastVerseOfChapter(id, book, chapter) ?? 0
      for (let verse = 0; verse <= last; verse++) {
        if (versificationHasVerse(id, v(book, chapter, verse))) verses.push(v(book, chapter, verse))
      }
    }
  }
  return verses
}

/** The verse keys of ranges written `book-chapter-first..last`, or single keys. */
const keysOf = (...ranges: string[]): string[] =>
  ranges.flatMap(range => {
    const match = /^(\d+-\d+)-(\d+)\.\.(\d+)$/.exec(range)
    if (!match) return [range]
    return Array.from(
      { length: Number(match[3]) - Number(match[2]) + 1 },
      (_, offset) => `${match[1]}-${Number(match[2]) + offset}`
    )
  })

// The additions to Esther and Daniel of the Latin and French Catholic Bibles (books 1-66 only,
// decided 2026-11-27).
const LATIN_ADDITIONS = keysOf(
  '17-10-4..13',
  '17-11-1..12',
  '17-12-1..6',
  '17-13-1..18',
  '17-14-1..19',
  '17-15-1..19',
  '17-16-1..24',
  '27-3-24..90'
)

/** Verses with no org equivalent, keyed by versification: additions to the 66 books. */
const WITHOUT_EQUIVALENT: Readonly<Record<string, readonly string[]>> = {
  'clementine-vulgate': [...LATIN_ADDITIONS, ...keysOf('27-13-1..65', '27-14-1..42')],
  'bible-strong-catholic-extended-esther-daniel': [
    ...LATIN_ADDITIONS,
    ...keysOf('27-13-1..65', '27-14-1..42'),
  ],
  // Job's genealogy, Psalm 151, Proverbs 4:27b, the verses lxx.vrs says Jeremiah lacks, and the
  // additions to Daniel.
  'theotex-septuagint': keysOf(
    '18-42-18..19',
    '19-151-1..7',
    '20-4-28',
    '24-32-2..12',
    '24-46-5..13',
    '27-3-24..90',
    '27-13-1..64',
    '27-14-1..41'
  ),
}

/** Org verses a numbering has no verse for, keyed by versification: verses its text lacks. */
const ORG_WITHOUT_EQUIVALENT: Readonly<Record<string, readonly string[]>> = {
  // The published Ostervald has no Psalm 40:17 ("Que tous ceux qui te cherchent…").
  'bs-ost': ['19-40-17'],
  // The published NET has no Jonah 1:17 (org 2:1, the great fish).
  'bs-net': ['32-2-1'],
  // The published Chouraqui has no Psalm 119:8 ("Je veux garder tes statuts…") nor John 7:53.
  'bs-chu': ['19-119-8', '43-7-53'],
  // The published SBLGNT leaves out John 7:53 and the doxology of Romans 16:25-27.
  'bs-sblgnt': ['43-7-53', '45-16-25', '45-16-26', '45-16-27'],
  // Crampon has no Joshua 21:36-37 (the cities of Reuben).
  'bible-strong-catholic-extended-esther-daniel': ['6-21-36', '6-21-37'],
  // Hebrew verses lxx.vrs gives no Septuagint verse: absent from the Greek, or only in a
  // lettered subdivision (1 Kings 4:20 in 2:46a).
  'theotex-septuagint': keysOf(
    '2-36-9..17',
    '2-36-20..23',
    '2-36-25..38',
    '2-37-22..29',
    '2-38-28..31',
    '2-39-31..43',
    '4-6-27',
    '6-8-30..35',
    '6-10-43',
    '6-13-33',
    '9-17-55..58',
    '9-18-30',
    '11-4-20',
    '11-6-37..38',
    '11-7-51',
    '16-3-38',
    '20-18-23..24',
    '23-2-22',
    '23-56-12',
    '24-25-14',
    '24-33-14..26',
    '24-39-4..13',
    '24-48-45..47'
  ),
}

describe('every verse goes to org and back', () => {
  for (const id of VERSIFICATION_IDS) {
    test(id, () => {
      const withoutEquivalent: string[] = []
      for (const ref of allVerses(id)) {
        const pivot = toPivot(id, ref).verses
        if (pivot.length === 0) withoutEquivalent.push(`${ref.book}-${ref.chapter}-${ref.verse}`)
        for (const pivotRef of pivot) {
          assert.ok(
            fromPivot(id, pivotRef).verses.some(
              back => JSON.stringify(back) === JSON.stringify(ref)
            ),
            `${id} ${JSON.stringify(ref)} → ${JSON.stringify(pivotRef)} does not come back`
          )
        }
      }
      assert.deepEqual(withoutEquivalent, WITHOUT_EQUIVALENT[id] ?? [])
      const orgWithoutEquivalent = allVerses('org')
        .filter(pivotRef => fromPivot(id, pivotRef).verses.length === 0)
        .map(ref => `${ref.book}-${ref.chapter}-${ref.verse}`)
      assert.deepEqual(
        orgWithoutEquivalent,
        ORG_WITHOUT_EQUIVALENT[id] ?? [],
        `org verses with no verse in ${id}`
      )
    })
  }
})

/**
 * Chapters, keyed `book-chapter`, where a declared Bible's last verse differs from its
 * versification: known source gaps or a numbering not yet described by an overlay.
 */
const KNOWN_DIFFERENCES: Readonly<Record<string, readonly string[]>> = {
  S21: ['4-25'], // Numbers 25 ends at 18, as in English Bibles
  BDS: ['13-25'], // 1 Chronicles 25 ends with a merged verse
  BHS: ['29-4'], // Joel 4 is missing from the publication
  CHU: ['14-36', '29-4'], // 2 Chronicles 36 and Joel 4 are missing from the publication
  LXX_FR: ['27-13', '27-14'], // Susanna and Bel are not translated
}

describe('every declared Bible matches its versification', () => {
  const bibles = (coverage as { bibles: Record<string, Record<string, number[]>> }).bibles
  for (const [versionId, id] of Object.entries(BIBLE_VERSIFICATIONS)) {
    test(`${versionId} follows ${id}`, () => {
      const published = bibles[versionId]
      assert.ok(published, `${versionId} is missing from the coverage snapshot`)
      const differences: string[] = []
      for (const [book, lastVerses] of Object.entries(published)) {
        const chapterCount = Math.max(
          lastVerses.length,
          ...[...Array(200).keys()]
            .filter(chapter => lastVerseOfChapter(id, Number(book), chapter + 1) !== undefined)
            .map(chapter => chapter + 1)
        )
        for (let chapter = 1; chapter <= chapterCount; chapter++) {
          if (lastVerses[chapter - 1] !== lastVerseOfChapter(id, Number(book), chapter)) {
            differences.push(`${book}-${chapter}`)
          }
        }
      }
      assert.deepEqual(differences, KNOWN_DIFFERENCES[versionId] ?? [])
    })
  }
})
