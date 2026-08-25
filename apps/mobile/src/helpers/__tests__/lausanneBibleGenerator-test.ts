/* eslint-disable @typescript-eslint/no-require-imports */
const {
  decodeWindows1252,
  getCoverage,
  parseLausanneBibleText,
  validateLausanneBible,
} = require('../../../scripts/lib/lausanneBible.cjs')

describe('Lausanne Bible generator', () => {
  it('decodes the source typography independently from the Node ICU build', () => {
    expect(decodeWindows1252(Buffer.from([0x63, 0x9c, 0x75, 0x72, 0x20, 0x85]))).toBe('cœur …')
  })

  it('maps Lausanne references to the Bible Strong JSON shape without rewriting the text', () => {
    const source = [
      'Gen 1:1 ¶ Au commencement Dieu créa les cieux et la terre.',
      "Exo 20:14 Tu ne commettras point d'adultère.",
      'Joe 2:28 Après cela, je répandrai mon Esprit.',
      "Joe 3:21 et l'Eternel demeurera en Sion.",
    ].join('\r\n')

    const result = parseLausanneBibleText(source)

    expect(result.bible).toEqual({
      1: {
        1: {
          1: '¶ Au commencement Dieu créa les cieux et la terre.',
        },
      },
      2: {
        20: {
          14: "Tu ne commettras point d'adultère.",
        },
      },
      29: {
        3: {
          1: 'Après cela, je répandrai mon Esprit.',
        },
        4: {
          21: "et l'Eternel demeurera en Sion.",
        },
      },
    })
    expect(result.verseCount).toBe(4)
  })

  it('rejects malformed, unknown, and duplicate source references', () => {
    const source = [
      'Gen 1:1 First',
      'Gen 1:1 Duplicate',
      'Unknown 1:1 Unknown book',
      'This is not a verse',
    ].join('\n')

    expect(() => parseLausanneBibleText(source)).toThrow(
      [
        'Lausanne parsing failed:',
        '- Duplicate reference Gen 1:1 on line 2',
        '- Unknown book code Unknown on line 3',
        '- Malformed line 4: This is not a verse',
      ].join('\n')
    )
  })

  it('joins physical continuation lines into their preceding verse', () => {
    const source = [
      'Gen 1:1 First part',
      ' second part',
      'Exo 1:1 ',
      'Verse text after an empty reference line.',
    ].join('\r\n')

    expect(parseLausanneBibleText(source).bible).toEqual({
      1: { 1: { 1: 'First part second part' } },
      2: { 1: { 1: 'Verse text after an empty reference line.' } },
    })
  })

  it('enforces the audited Lausanne corpus canaries', () => {
    const bible = {
      2: {
        20: {
          ...Object.fromEntries(Array.from({ length: 13 }, (_, index) => [index + 1, 'text'])),
          14: "Tu ne commettras point d'adultère.",
        },
      },
      29: {
        1: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 'text'])),
        2: Object.fromEntries(Array.from({ length: 27 }, (_, index) => [index + 1, 'text'])),
        3: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [index + 1, 'text'])),
        4: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [index + 1, 'text'])),
      },
    }

    expect(() =>
      validateLausanneBible(bible, {
        expectedBookCount: 2,
        expectedBookNumbers: [2, 29],
        expectedVerseCount: 87,
        expectedCoverageSha256: getCoverage(bible).coverageSha256,
      })
    ).not.toThrow()

    bible[2][20][14] = 'Incorrect'

    expect(() =>
      validateLausanneBible(bible, {
        expectedBookCount: 2,
        expectedBookNumbers: [2, 29],
        expectedVerseCount: 87,
        expectedCoverageSha256: getCoverage(bible).coverageSha256,
      })
    ).toThrow('Exodus 20:14 does not match the audited Lausanne source')
  })

  it('rejects compensated coverage corruption and invalid verse text', () => {
    const validBible = {
      2: {
        20: {
          ...Object.fromEntries(Array.from({ length: 13 }, (_, index) => [index + 1, 'text'])),
          14: "Tu ne commettras point d'adultère.",
        },
      },
      29: {
        1: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 'text'])),
        2: Object.fromEntries(Array.from({ length: 27 }, (_, index) => [index + 1, 'text'])),
        3: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [index + 1, 'text'])),
        4: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [index + 1, 'text'])),
      },
    }
    const expectedCoverageSha256 = getCoverage(validBible).coverageSha256
    const corruptedBible = structuredClone(validBible)
    delete corruptedBible[29][1][20]
    corruptedBible[29][2][28] = '\ud800'

    expect(() =>
      validateLausanneBible(corruptedBible, {
        expectedBookCount: 2,
        expectedBookNumbers: [2, 29],
        expectedVerseCount: 87,
        expectedCoverageSha256,
      })
    ).toThrow(/Coverage checksum mismatch/)
    expect(() =>
      validateLausanneBible(corruptedBible, {
        expectedBookCount: 2,
        expectedBookNumbers: [2, 29],
        expectedVerseCount: 87,
        expectedCoverageSha256,
      })
    ).toThrow(/Invalid Unicode/)
  })
})
