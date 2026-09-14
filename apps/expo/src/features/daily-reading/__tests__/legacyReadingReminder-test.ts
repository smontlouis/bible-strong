import { findLegacyDailyReminderIds } from '../legacyReadingReminder'
import type { ExistingReminder } from '../readingReminderReconciler'

jest.mock('../../../../i18n', () => ({ getLanguage: () => 'fr' }))
const now = new Date(2026, 8, 14, 7).getTime()
const legacy: ExistingReminder = {
  id: 'AbCdEf0123456789abCd',
  timestamp: now + 3_600_000,
  title: 'Bonjour Lecteur',
  body: 'Une citation biblique.\nJean 17:17 LSG',
  data: {},
}

describe('legacy iOS verse reminders', () => {
  it('recognizes the old creator’s exact shape using the reference parser', () => {
    expect(findLegacyDailyReminderIds([legacy], now)).toEqual(new Set([legacy.id]))
  })
  it('does not adopt unrelated or ambiguous local notifications', () => {
    expect(findLegacyDailyReminderIds([{ ...legacy, data: { feature: 'other' } }], now).size).toBe(
      0
    )
    expect(findLegacyDailyReminderIds([{ ...legacy, title: 'Another reminder' }], now).size).toBe(0)
    expect(findLegacyDailyReminderIds([{ ...legacy, body: 'No reference here' }], now).size).toBe(0)
    expect(findLegacyDailyReminderIds([{ ...legacy, repeats: true }], now).size).toBe(0)
    expect(
      findLegacyDailyReminderIds([legacy, { ...legacy, id: 'XbCdEf0123456789abCd' }], now).size
    ).toBe(0)
  })
  it('does not adopt requests outside the old one-day scheduling window', () => {
    expect(findLegacyDailyReminderIds([{ ...legacy, timestamp: now - 1 }], now).size).toBe(0)
    expect(
      findLegacyDailyReminderIds([{ ...legacy, timestamp: now + 2 * 86400000 }], now).size
    ).toBe(0)
  })
})
