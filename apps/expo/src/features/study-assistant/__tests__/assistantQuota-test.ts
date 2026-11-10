import { getDefaultStore } from 'jotai'
import {
  asksEmailVerification,
  freeQuestionsPaused,
  assistantQuotaAtom,
  currentQuota,
  nextQuotaReset,
  quotaLine,
  quotaReturn,
  recordAssistantQuota,
} from '../assistantQuota'

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

  it('names the daily questions once the service has said how many', () => {
    const { key, count } = quotaReturn(new Date('2026-11-10T14:30:00Z'), 'fr', 3)
    expect(key).toMatch(/^assistant\.limitCard\.(today|tomorrow)Count$/)
    expect(count).toBe(3)
  })
})

const daily = (remaining: number) =>
  ({ kind: 'daily', limit: 3, remaining, resetsAt: '2026-11-11T00:00:00.000Z' }) as const

describe('currentQuota', () => {
  const now = new Date('2026-11-10T14:30:00Z')

  it('holds for the account it was given to, until the day ends', () => {
    const state = { uid: 'reader', quota: daily(2) }
    expect(currentQuota(state, 'reader', now)).toEqual(daily(2))
    expect(currentQuota(state, 'someone-else', now)).toBeNull()
    expect(currentQuota(state, null, now)).toBeNull()
    expect(currentQuota(state, 'reader', new Date('2026-11-11T00:00:00Z'))).toBeNull()
    expect(currentQuota(null, 'reader', now)).toBeNull()
  })

  it('keeps an unlimited or a waiting quota past midnight', () => {
    const unlimited = { uid: 'reader', quota: { kind: 'unlimited' } as const }
    expect(currentQuota(unlimited, 'reader', new Date('2026-11-12T00:00:00Z'))).toEqual({
      kind: 'unlimited',
    })
  })

  it('is recorded in the shared store', () => {
    recordAssistantQuota('reader', daily(1))
    expect(getDefaultStore().get(assistantQuotaAtom)).toEqual({ uid: 'reader', quota: daily(1) })
  })
})

describe('quotaLine', () => {
  it('counts what is left, says when the questions come back, and says nothing otherwise', () => {
    expect(quotaLine(daily(2), 'fr')).toEqual({ kind: 'remaining', count: 2 })
    expect(quotaLine(daily(0), 'fr')).toMatchObject({ kind: 'none' })
    expect(quotaLine({ kind: 'unlimited' }, 'fr')).toBeNull()
    expect(quotaLine({ kind: 'verify_email', limit: 3 }, 'fr')).toBeNull()
    expect(quotaLine(null, 'fr')).toBeNull()
  })
})

describe('asksEmailVerification', () => {
  it('asks while the account waits, or after a refusal the service has not taken back', () => {
    expect(asksEmailVerification('', { kind: 'verify_email', limit: 3 })).toBe(true)
    expect(asksEmailVerification('assistant.verifyEmail', null)).toBe(true)
    expect(asksEmailVerification('assistant.verifyEmail', daily(3))).toBe(false)
    expect(asksEmailVerification('assistant.verifyEmail', { kind: 'unlimited' })).toBe(false)
    expect(asksEmailVerification('assistant.limit', daily(0))).toBe(false)
  })
})

describe('a pause of the free questions', () => {
  const paused = { kind: 'paused', resumesAt: '2026-12-01T00:00:00.000Z' } as const

  it('holds until the free questions resume, and says until when', () => {
    const state = { uid: 'reader', quota: paused }
    expect(currentQuota(state, 'reader', new Date('2026-11-20T00:00:00Z'))).toEqual(paused)
    expect(currentQuota(state, 'reader', new Date('2026-12-01T00:00:00Z'))).toBeNull()
    expect(quotaLine(paused, 'fr')).toMatchObject({ kind: 'paused' })
  })

  it('is shown while the service says so, or after a refusal it has not taken back', () => {
    expect(freeQuestionsPaused('', paused)).toBe(true)
    expect(freeQuestionsPaused('assistant.freePaused', null)).toBe(true)
    expect(freeQuestionsPaused('assistant.freePaused', daily(3))).toBe(false)
    expect(freeQuestionsPaused('assistant.limit', daily(0))).toBe(false)
  })
})
