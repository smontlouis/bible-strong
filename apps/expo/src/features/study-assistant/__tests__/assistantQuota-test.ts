import { nextQuotaReset, quotaReturn } from '../assistantQuota'

jest.mock('~helpers/languageUtils', () => ({
  getDateLocale: () => undefined,
}))

describe('nextQuotaReset', () => {
  it('is the next midnight UTC', () => {
    expect(nextQuotaReset(new Date('2026-11-10T14:30:00Z')).toISOString()).toBe(
      '2026-11-11T00:00:00.000Z'
    )
  })

  it('moves to the next day one second after midnight UTC', () => {
    expect(nextQuotaReset(new Date('2026-11-10T00:00:01Z')).toISOString()).toBe(
      '2026-11-11T00:00:00.000Z'
    )
  })

  it('crosses the end of a month and of a year', () => {
    expect(nextQuotaReset(new Date('2026-12-31T23:59:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    )
  })
})

describe('quotaReturn', () => {
  it('names the reset day in local time', () => {
    const now = new Date('2026-11-10T14:30:00Z')
    const { key, reset } = quotaReturn(now, 'fr')
    const sameDay = reset.toDateString() === now.toDateString()
    expect(key).toBe(sameDay ? 'assistant.limitCard.today' : 'assistant.limitCard.tomorrow')
  })
})
