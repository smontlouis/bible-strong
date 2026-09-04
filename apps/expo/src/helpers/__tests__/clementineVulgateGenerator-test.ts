/* eslint-disable @typescript-eslint/no-require-imports */
const {
  decodeWindows1252,
  getClementineCoverage,
  normalizeClementineVerseText,
  parseClementineVulgateFiles,
  validateClementineVulgate,
} = require('../../../scripts/lib/clementineVulgate.cjs')

describe('Clementine Vulgate generator', () => {
  it('decodes the official Windows-1252 source independently from the Node ICU build', () => {
    expect(decodeWindows1252(Buffer.from([0x63, 0x9c, 0x75, 0x72, 0x20, 0x85]))).toBe('cœur …')
  })

  it('maps the 73 official source filenames to stable Bible Strong book IDs', () => {
    const files = {
      'Gn.lat': '1:1 In principio creavit Deus cælum et terram.',
      'Est.lat': '16:24 Omnis autem provincia.',
      'Dn.lat': '14:42 Tunc rex ait.',
      'Tob.lat': '1:1 Tobias ex tribu et civitate Nephthali.',
      'Jdt.lat': '1:1 Arphaxad itaque rex Medorum.',
      'Sap.lat': '1:1 Diligite justitiam.',
      'Sir.lat': '1:1 Omnis sapientia a Domino Deo est.',
      'Bar.lat': '6:1 Propter peccata quæ peccastis ante Deum.',
      '1Mcc.lat': '1:1 Et factum est.',
      '2Mcc.lat': '15:39 Et si quidem bene.',
      'Mt.lat': '1:1 Liber generationis Jesu Christi.',
      'Apc.lat': '22:21 Gratia Domini nostri Jesu Christi cum omnibus vobis.',
    }

    const result = parseClementineVulgateFiles(files)

    expect(result.bible).toEqual({
      1: { 1: { 1: 'In principio creavit Deus cælum et terram.' } },
      17: { 16: { 24: 'Omnis autem provincia.' } },
      27: { 14: { 42: 'Tunc rex ait.' } },
      40: { 1: { 1: 'Liber generationis Jesu Christi.' } },
      66: { 22: { 21: 'Gratia Domini nostri Jesu Christi cum omnibus vobis.' } },
      67: { 1: { 1: 'Tobias ex tribu et civitate Nephthali.' } },
      68: { 1: { 1: 'Arphaxad itaque rex Medorum.' } },
      69: { 1: { 1: 'Diligite justitiam.' } },
      70: { 1: { 1: 'Omnis sapientia a Domino Deo est.' } },
      71: { 6: { 1: 'Propter peccata quæ peccastis ante Deum.' } },
      72: { 1: { 1: 'Et factum est.' } },
      73: { 15: { 39: 'Et si quidem bene.' } },
    })
    expect(result.verseCount).toBe(12)
  })

  it('normalizes only declared editorial markers while preserving their content', () => {
    expect(
      normalizeClementineVerseText('<Prologus>Textus [<Aleph>prima linea/ secunda linea.]\\')
    ).toBe('Prologus Textus Aleph prima linea secunda linea.')
    expect(
      normalizeClementineVerseText(
        '<Exemplar epistolæ quam misit Jeremias ad abducendos captivos in Babyloniam a rege Babyloniorum, ut annuntiaret illis secundum quod præceptum est illi a Deo>Propter peccata.'
      )
    ).toBe('Propter peccata.')
  })

  it('rejects malformed, unknown, duplicate, and empty source references', () => {
    expect(() =>
      parseClementineVulgateFiles({
        'Gn.lat': ['1:1 First', '1:1 Duplicate', '1:2 ', 'This is not a verse'].join('\n'),
        'Unknown.lat': '1:1 Unknown',
      })
    ).toThrow(
      [
        'Clementine Vulgate parsing failed:',
        '- Duplicate reference Gn.lat 1:1 on line 2',
        '- Empty verse Gn.lat 1:2 on line 3',
        '- Malformed line 4 in Gn.lat: This is not a verse',
        '- Unknown source file Unknown.lat',
      ].join('\n')
    )
  })

  it('validates exact coverage, contiguous references, Unicode, and source canaries', () => {
    const bible: Record<number, Record<number, Record<number, string>>> = {
      1: { 1: { 1: 'In principio.' } },
      29: {
        1: { 1: 'Joel one.' },
        2: { 1: 'Joel two.' },
        3: { 1: 'Joel three.' },
      },
      67: { 1: { 1: 'Tobias.' } },
    }
    const expectedCoverageSha256 = getClementineCoverage(bible).coverageSha256

    expect(() =>
      validateClementineVulgate(bible, {
        expectedBookCount: 3,
        expectedBookNumbers: [1, 29, 67],
        expectedChapterCount: 5,
        expectedVerseCount: 5,
        expectedCoverageSha256,
        expectedJoelChapterCounts: [1, 1, 1],
        canaries: [
          { book: 1, chapter: 1, verse: 1, text: 'In principio.' },
          { book: 67, chapter: 1, verse: 1, text: 'Tobias.' },
        ],
      })
    ).not.toThrow()

    const corruptedBible = structuredClone(bible)
    delete corruptedBible[29][2][1]
    corruptedBible[29][3][2] = '\ud800'

    expect(() =>
      validateClementineVulgate(corruptedBible, {
        expectedBookCount: 3,
        expectedBookNumbers: [1, 29, 67],
        expectedChapterCount: 5,
        expectedVerseCount: 5,
        expectedCoverageSha256,
        expectedJoelChapterCounts: [1, 1, 1],
        canaries: [{ book: 1, chapter: 1, verse: 1, text: 'Incorrect' }],
      })
    ).toThrow(/Coverage checksum mismatch/)
    expect(() =>
      validateClementineVulgate(corruptedBible, {
        expectedBookCount: 3,
        expectedBookNumbers: [1, 29, 67],
        expectedChapterCount: 5,
        expectedVerseCount: 5,
        expectedCoverageSha256,
        expectedJoelChapterCounts: [1, 1, 1],
        canaries: [{ book: 1, chapter: 1, verse: 1, text: 'Incorrect' }],
      })
    ).toThrow(/Invalid Unicode/)
    expect(() =>
      validateClementineVulgate(corruptedBible, {
        expectedBookCount: 3,
        expectedBookNumbers: [1, 29, 67],
        expectedChapterCount: 5,
        expectedVerseCount: 5,
        expectedCoverageSha256,
        expectedJoelChapterCounts: [1, 1, 1],
        canaries: [{ book: 1, chapter: 1, verse: 1, text: 'Incorrect' }],
      })
    ).toThrow(/Source canary mismatch/)
  })
})
