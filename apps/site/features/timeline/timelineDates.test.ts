import { describe, expect, it } from 'vitest'
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
    expect(parseTimelineDates('1444 BC')).toEqual({ kind: 'years', start: -1444, end: -1444 })
    expect(parseTimelineDates('3954-3024 BC')).toEqual({ kind: 'years', start: -3954, end: -3024 })
    expect(parseTimelineDates('56 AD')).toEqual({ kind: 'years', start: 56, end: 56 })
    expect(parseTimelineDates(' 51-52 AD ')).toEqual({ kind: 'years', start: 51, end: 52 })
  })

  it('reads spans across eras, open spans and spans into the future', () => {
    expect(parseTimelineDates('89 BC-7 AD')).toEqual({ kind: 'years', start: -89, end: 7 })
    expect(parseTimelineDates('1559-')).toEqual({ kind: 'years', start: 1559, end: 'open' })
    expect(parseTimelineDates('476-Future')).toEqual({ kind: 'years', start: 476, end: 'future' })
    expect(parseTimelineDates('539 BC-Future')).toEqual({
      kind: 'years',
      start: -539,
      end: 'future',
    })
  })

  it('reads the undated horizons of the prophetic events', () => {
    expect(parseTimelineDates('Future')).toEqual({ kind: 'future' })
    expect(parseTimelineDates('After Millenium')).toEqual({ kind: 'afterMillennium' })
    expect(parseTimelineDates('After Millennium')).toEqual({ kind: 'afterMillennium' })
  })

  it('infers nothing from other wording', () => {
    for (const value of ['', 'c. 1444 BC', '1444', '0 AD', '1444 BCE', 'vers 30', '12-10', 'BC']) {
      expect(parseTimelineDates(value)).toBeUndefined()
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
    expect(
      [...datings].sort((left, right) => timelineDatesRank(left) - timelineDatesRank(right))
    ).toEqual([...datings].reverse())
    expect(timelineDatesRank('31 AD')).toBe(timelineDatesRank('31-34 AD'))
  })

  it('writes a dating in French', () => {
    expect(formatTimelineDates('1444 BC', 'fr')).toBe('1444 av. J.-C.')
    expect(formatTimelineDates('3954-3024 BC', 'fr')).toBe('3954–3024 av. J.-C.')
    expect(formatTimelineDates('56 AD', 'fr')).toBe('56 ap. J.-C.')
    expect(formatTimelineDates('538-1798 AD', 'fr')).toBe('538–1798 ap. J.-C.')
    expect(formatTimelineDates('89 BC-7 AD', 'fr')).toBe('89 av. J.-C. – 7 ap. J.-C.')
    expect(formatTimelineDates('1559-', 'fr')).toBe('À partir de 1559 ap. J.-C.')
    expect(formatTimelineDates('476-Future', 'fr')).toBe('476 ap. J.-C. – futur')
    expect(formatTimelineDates('539 BC-Future', 'fr')).toBe('539 av. J.-C. – futur')
    expect(formatTimelineDates('Future', 'fr')).toBe('Futur')
    expect(formatTimelineDates('After Millenium', 'fr')).toBe('Après le millénium')
  })

  it('writes a dating in English', () => {
    expect(formatTimelineDates('3954-3024 BC', 'en')).toBe('3954–3024 BC')
    expect(formatTimelineDates('89 BC-7 AD', 'en')).toBe('89 BC – 7 AD')
    expect(formatTimelineDates('1559-', 'en')).toBe('From 1559 AD')
    expect(formatTimelineDates('476-Future', 'en')).toBe('476 AD – future')
    expect(formatTimelineDates('After Millenium', 'en')).toBe('After the Millennium')
  })

  it('keeps the years of a span in the order the publication writes them', () => {
    expect(formatTimelineDates('867-878 BC', 'fr')).toBe('867–878 av. J.-C.')
  })

  it('shows a dating outside the grammar as written', () => {
    expect(formatTimelineDates(' c. 1444 BC ', 'fr')).toBe('c. 1444 BC')
  })

  it('gives the years an event is drawn over, when it has some', () => {
    expect(timelineYearSpan('3954-3024 BC')).toEqual({ startYear: -3954, endYear: -3024 })
    expect(timelineYearSpan('1559-')).toEqual({ startYear: 1559, endYear: 1559 })
    expect(timelineYearSpan('Future')).toBeUndefined()
    expect(timelineYearSpan('long ago')).toBeUndefined()
  })

  it('names a year of the drawn timeline', () => {
    expect(formatTimelineYear(-1050, 'fr')).toBe('1050 av. J.-C.')
    expect(formatTimelineYear(31, 'en')).toBe('31 AD')
    expect(formatTimelineYear(0, 'en')).toBe('1 AD')
    expect(formatTimelineYear(2500, 'fr')).toBe('Futur')
  })

  it('writes a year as a number, negative before our era', () => {
    expect(formatTimelineYearNumber(-1050)).toBe('−1050')
    expect(formatTimelineYearNumber(31)).toBe('31')
    expect(formatTimelineYearNumber(0)).toBe('1')
    expect(formatTimelineYearNumber(2500)).toBe('')
  })
})
