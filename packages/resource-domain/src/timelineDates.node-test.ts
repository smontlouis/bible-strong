import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatTimelineDates,
  formatTimelineYear,
  formatTimelineYearNumber,
  parseTimelineDates,
  timelineDatesRank,
  timelineYearSpan,
} from './timelineDates'

describe('Timeline datings', () => {
  it('reads years and spans of one era', () => {
    assert.deepEqual(parseTimelineDates('1444 BC'), { kind: 'years', start: -1444, end: -1444 })
    assert.deepEqual(parseTimelineDates('3954-3024 BC'), {
      kind: 'years',
      start: -3954,
      end: -3024,
    })
    assert.deepEqual(parseTimelineDates('56 AD'), { kind: 'years', start: 56, end: 56 })
    assert.deepEqual(parseTimelineDates(' 51-52 AD '), { kind: 'years', start: 51, end: 52 })
  })

  it('reads spans across eras, open spans and spans into the future', () => {
    assert.deepEqual(parseTimelineDates('89 BC-7 AD'), { kind: 'years', start: -89, end: 7 })
    assert.deepEqual(parseTimelineDates('1559-'), { kind: 'years', start: 1559, end: 'open' })
    assert.deepEqual(parseTimelineDates('476-Future'), {
      kind: 'years',
      start: 476,
      end: 'future',
    })
    assert.deepEqual(parseTimelineDates('539 BC-Future'), {
      kind: 'years',
      start: -539,
      end: 'future',
    })
  })

  it('reads the undated horizons of the prophetic events', () => {
    assert.deepEqual(parseTimelineDates('Future'), { kind: 'future' })
    assert.deepEqual(parseTimelineDates('After Millenium'), { kind: 'afterMillennium' })
    assert.deepEqual(parseTimelineDates('After Millennium'), { kind: 'afterMillennium' })
  })

  it('infers nothing from other wording', () => {
    for (const value of ['', 'c. 1444 BC', '1444', '0 AD', '1444 BCE', 'vers 30', '12-10', 'BC']) {
      assert.equal(parseTimelineDates(value), undefined)
    }
  })

  it('ranks datings by their first year, undated ones after every year', () => {
    const datings = [
      'unknown',
      'After Millenium',
      'Future',
      '1844-',
      '56 AD',
      '89 BC-7 AD',
      '539 BC-Future',
      '3954-3024 BC',
    ]
    assert.deepEqual(
      [...datings].sort((left, right) => timelineDatesRank(left) - timelineDatesRank(right)),
      [...datings].reverse()
    )
    assert.equal(timelineDatesRank('31 AD'), timelineDatesRank('31-34 AD'))
  })

  it('writes a dating in French', () => {
    assert.equal(formatTimelineDates('1444 BC', 'fr'), '1444 av. J.-C.')
    assert.equal(formatTimelineDates('3954-3024 BC', 'fr'), '3954–3024 av. J.-C.')
    assert.equal(formatTimelineDates('56 AD', 'fr'), '56 ap. J.-C.')
    assert.equal(formatTimelineDates('538-1798 AD', 'fr'), '538–1798 ap. J.-C.')
    assert.equal(formatTimelineDates('89 BC-7 AD', 'fr'), '89 av. J.-C. – 7 ap. J.-C.')
    assert.equal(formatTimelineDates('1559-', 'fr'), 'À partir de 1559 ap. J.-C.')
    assert.equal(formatTimelineDates('476-Future', 'fr'), '476 ap. J.-C. – futur')
    assert.equal(formatTimelineDates('539 BC-Future', 'fr'), '539 av. J.-C. – futur')
    assert.equal(formatTimelineDates('Future', 'fr'), 'Futur')
    assert.equal(formatTimelineDates('After Millenium', 'fr'), 'Après le millénium')
  })

  it('writes a dating in English', () => {
    assert.equal(formatTimelineDates('3954-3024 BC', 'en'), '3954–3024 BC')
    assert.equal(formatTimelineDates('89 BC-7 AD', 'en'), '89 BC – 7 AD')
    assert.equal(formatTimelineDates('1559-', 'en'), 'From 1559 AD')
    assert.equal(formatTimelineDates('476-Future', 'en'), '476 AD – future')
    assert.equal(formatTimelineDates('After Millenium', 'en'), 'After the Millennium')
  })

  it('keeps the years of a span in the order the publication writes them', () => {
    assert.equal(formatTimelineDates('867-878 BC', 'fr'), '867–878 av. J.-C.')
  })

  it('shows a dating outside the grammar as written', () => {
    assert.equal(formatTimelineDates(' c. 1444 BC ', 'fr'), 'c. 1444 BC')
  })

  it('gives the years an event is drawn over, when it has some', () => {
    assert.deepEqual(timelineYearSpan('3954-3024 BC'), { startYear: -3954, endYear: -3024 })
    assert.deepEqual(timelineYearSpan('1559-'), { startYear: 1559, endYear: 1559 })
    assert.equal(timelineYearSpan('Future'), undefined)
    assert.equal(timelineYearSpan('long ago'), undefined)
  })

  it('names a year of the drawn timeline', () => {
    assert.equal(formatTimelineYear(-1050, 'fr'), '1050 av. J.-C.')
    assert.equal(formatTimelineYear(31, 'en'), '31 AD')
    assert.equal(formatTimelineYear(0, 'en'), '1 AD')
    assert.equal(formatTimelineYear(2500, 'fr'), 'Futur')
  })

  it('writes a year as a number, negative before our era', () => {
    assert.equal(formatTimelineYearNumber(-1050), '−1050')
    assert.equal(formatTimelineYearNumber(31), '31')
    assert.equal(formatTimelineYearNumber(0), '1')
    assert.equal(formatTimelineYearNumber(2500), '')
  })
})
