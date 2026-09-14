import type { Plan, ReadingSlice } from '~common/types'
import houstinCalendar from '../houstinCalendar.json'
import spurgeonCalendar from '../spurgeonCalendar.json'
import { meditationSupplements } from '../meditationSupplements'
import {
  findMeditationForDate,
  normalizeMeditationCollection,
  getMeditationReadings,
  getEditorialKind,
  getMeditationDateKey,
  getMeditationTitle,
  getMeditationOpening,
  getPlanDayDate,
  getScheduledPlanDay,
} from '../readingCalendar'

const entry = (id: string, title: string): ReadingSlice => ({ id, title, slices: [] })
const collection = (entries: ReadingSlice[]): Pick<Plan, 'sections'> => ({
  sections: [{ id: 'month', title: 'Month', subTitle: '', readingSlices: entries }],
})

describe('reading calendars', () => {
  const fullCollection = (id: string, entries: ReadingSlice[]): Plan => ({
    id,
    ...collection(entries),
    type: 'meditation',
    lang: 'fr',
    title: 'Collection',
    author: { id: 'author', displayName: 'Author', photoUrl: '' },
  })

  it('normalizes dates and complementary readings without mutating content or losing legacy IDs', () => {
    const readings = Object.entries(houstinCalendar).map(([id, row]) => entry(id, row.legacyTitle))
    const original = fullCollection('365j', readings)
    const before = JSON.stringify(original)
    const normalized = normalizeMeditationCollection(original)
    const flattened = normalized.sections.flatMap(section => section.readingSlices)
    expect(JSON.stringify(original)).toBe(before)
    expect(
      flattened
        .filter(reading => !reading.id.startsWith('365j-'))
        .map(reading => reading.id)
        .sort()
    ).toEqual(readings.map(reading => reading.id).sort())
    expect(flattened).toHaveLength(367)
    expect(normalized.sections.at(-1)).toMatchObject({
      title: 'Lectures complémentaires',
      readingSlices: [{ id: '293', calendarDate: null }],
    })
    expect(findMeditationForDate(normalized, '2024-02-29')).toMatchObject({
      status: 'available',
      reading: { calendarDate: '02-29', title: expect.stringContaining('29 février') },
    })
    expect(normalizeMeditationCollection(normalized)).toEqual(normalized)
  })

  it('fills the verified complete French Spurgeon corpus and defers to publisher additions', () => {
    const readings = Object.entries(spurgeonCalendar).map(([id, row]) => entry(id, row.legacyTitle))
    const original = fullCollection('ltdlf', readings)
    const normalized = normalizeMeditationCollection(original)
    expect(getMeditationReadings(normalized)).toHaveLength(366)
    expect(findMeditationForDate(normalized, '2024-12-31')).toMatchObject({
      status: 'available',
      reading: { id: 'ltdlf-12-31' },
    })
    expect(normalizeMeditationCollection(normalized)).toEqual(normalized)
    expect(getMeditationReadings({ ...original, lastUpdate: 999 })).toHaveLength(365)
    const publisherReading = { ...entry('publisher-dec31', 'Revised'), calendarDate: '12-31' }
    const revised = { ...original, ...collection([...readings, publisherReading]) }
    expect(findMeditationForDate(revised, '2024-12-31')).toEqual({
      status: 'available',
      reading: publisherReading,
    })
  })

  it('adds English February 29 without shifting March or duplicating December 31', () => {
    const readings = Array.from({ length: 365 }, (_, index) => ({
      ...entry(
        String(100 + index),
        index === 0
          ? "The Bible's First Promise"
          : index === 364
            ? 'No Stranger in Heaven'
            : 'Reading'
      ),
      calendarDate: getPlanDayDate('2025-01-01', index + 1)!.slice(5),
    }))
    const plan = fullCollection('faith-checkbook', readings)
    expect(findMeditationForDate(plan, '2024-02-29')).toEqual({
      status: 'available',
      reading: meditationSupplements['faith-checkbook'].entry,
    })
    expect(findMeditationForDate(plan, '2024-03-01')).toMatchObject({
      status: 'available',
      reading: { id: '159' },
    })
    expect(getMeditationReadings(plan)).toHaveLength(366)
  })

  it('uses the chosen Houstin PDF dates while retaining the EPUB-only reading identity', () => {
    const entries = Object.entries(houstinCalendar).map(([id, value]) =>
      entry(id, value.legacyTitle)
    )
    const plan = { id: '365j', ...collection(entries) }
    for (const [id, value] of Object.entries(houstinCalendar)) {
      if (value.date) {
        expect(findMeditationForDate(plan, `2024-${value.date}`)).toEqual({
          status: 'available',
          reading: entries.find(reading => reading.id === id),
        })
      }
    }
    // The extra July 12 EPUB text remains stored, but does not displace the PDF reading.
    expect(plan.sections[0].readingSlices).toHaveLength(365)
    expect(plan.sections[0].readingSlices.find(reading => reading.id === '293')).toBeDefined()
    expect(findMeditationForDate(plan, '2024-07-17')).toMatchObject({
      status: 'available',
      reading: { id: '365j-07-17' },
    })
    expect(findMeditationForDate(plan, '2024-12-31')).toMatchObject({
      status: 'available',
      reading: { id: '365j-12-31' },
    })
    // A future publisher revision with an explicit date is authoritative.
    const revised = { ...entries[0], calendarDate: '12-31' }
    expect(findMeditationForDate({ id: '365j', ...collection([revised]) }, '2024-12-31')).toEqual({
      status: 'available',
      reading: revised,
    })
  })

  it('retains the fixed schedule through leap days, missed readings and year boundaries', () => {
    expect(getScheduledPlanDay('2024-02-28', '2024-03-01')).toBe(3)
    expect(getScheduledPlanDay('2025-02-28', '2025-03-01')).toBe(2)
    expect(getScheduledPlanDay('2025-12-31', '2026-01-03')).toBe(4)
    expect(getScheduledPlanDay('2026-09-14', '2026-09-13')).toBe(0)
    expect(getPlanDayDate('2024-03-30', 3)).toBe('2024-04-01')
    expect(getPlanDayDate('2024-10-26', 3)).toBe('2024-10-28')
  })

  it('rejects invalid dates instead of silently rolling them forward', () => {
    expect(getScheduledPlanDay('2025-02-29', '2025-03-01')).toBeUndefined()
    expect(getPlanDayDate('2026-09-14', 0)).toBeUndefined()
    expect(getPlanDayDate('2026-09-14', 1.5)).toBeUndefined()
  })

  it('recognizes actual published labels as well as legacy internal labels', () => {
    expect(getEditorialKind({ type: 'meditation' })).toBe('daily-meditation')
    expect(getEditorialKind({ type: 'Livre de méditation' })).toBe('daily-meditation')
    expect(getEditorialKind({ type: 'Yearly Plan' })).toBe('reading-plan')
  })

  it('reads explicit dates independently of legacy IDs and preserves missing leap days', () => {
    expect(getMeditationDateKey(entry('155.24', 'La justice et la vie, 1 janvier'))).toBe('01-01')
    expect(getMeditationDateKey(entry('100', 'Une promesse, Février 29'))).toBe('02-29')
    expect(getMeditationDateKey(entry('1', 'Hope, February 29'))).toBe('02-29')
    expect(getMeditationDateKey(entry('2', 'Hope, February 30'))).toBeUndefined()
    const march = entry('159', 'Espérance, Mars 1')
    const plan = collection([entry('158', 'Espérance, Février 28'), march])
    expect(findMeditationForDate(plan, '2024-02-29')).toEqual({ status: 'missing' })
    expect(findMeditationForDate(plan, '2024-03-01')).toEqual({
      status: 'available',
      reading: march,
    })
    expect(findMeditationForDate(plan, '2025-02-29')).toEqual({ status: 'invalid-date' })
  })

  it('corrects the audited Spurgeon shift without changing reading identity', () => {
    const leapDay = entry('159', 'Ce qui nous suit, Mars 1')
    const march = entry('160', 'Joie pour les rejetés, Mars 2')
    const plan = { id: 'ltdlf', ...collection([leapDay, march]) }
    expect(findMeditationForDate(plan, '2024-02-29')).toEqual({
      status: 'available',
      reading: leapDay,
    })
    expect(findMeditationForDate(plan, '2026-03-01')).toEqual({
      status: 'available',
      reading: march,
    })
    expect(findMeditationForDate(plan, '2026-12-31')).toEqual({ status: 'missing' })
    expect(leapDay.title).toBe('Ce qui nous suit, Mars 1')
    const revised = entry('159', 'Ce qui nous suit, 29 février')
    expect(findMeditationForDate({ id: 'ltdlf', ...collection([revised]) }, '2024-02-29')).toEqual({
      status: 'available',
      reading: revised,
    })
  })

  it('only removes a verified date suffix from meditation titles', () => {
    expect(getMeditationTitle({ title: 'La foi, source de vie, 2 mars' })).toBe(
      'La foi, source de vie'
    )
    expect(getMeditationTitle({ title: 'La foi, source de vie' })).toBe('La foi, source de vie')
    expect(getMeditationTitle({ title: 'Espérance, February 29' })).toBe('Espérance')
  })

  it('does not silently choose between duplicate editorial dates', () => {
    expect(
      findMeditationForDate(
        collection([entry('a', '1 janvier'), entry('b', '1 janvier')]),
        '2026-01-01'
      )
    ).toEqual({ status: 'ambiguous' })
  })

  it('extracts only the designated opening and preserves the original passage and citation', () => {
    const reading: ReadingSlice = {
      id: '155.24',
      slices: [
        {
          id: '0',
          type: 'Text',
          subType: 'devotional',
          description: '\nLa vie. Proverbes 12:28.\nAD 7.1\n',
        },
        { id: '1', type: 'Text', description: 'The body is not the daily verse.' },
      ],
    }
    expect(getMeditationOpening(reading)).toEqual({
      text: 'La vie. Proverbes 12:28.',
      editorialCitation: 'AD 7.1',
      source: 'La vie. Proverbes 12:28.\nAD 7.1',
    })
    expect(getMeditationOpening({ slices: [] })).toBeUndefined()
    expect(getMeditationOpening({ slices: [reading.slices[0], reading.slices[0]] })).toBeUndefined()
  })
})
