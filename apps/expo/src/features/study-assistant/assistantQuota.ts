import { format } from 'date-fns'
import { atom, getDefaultStore } from 'jotai'
import type { StudyQuota } from '@bible-strong/ai-contract/contract'
import { getDateLocale } from '~helpers/languageUtils'

/** The daily quota of the assistant starts again at midnight UTC (the Worker counts by UTC day). */
export const nextQuotaReset = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * When the reader's questions come back, in their own time: today or tomorrow, at what hour.
 * With the number of questions the account receives a day, the sentence names it.
 */
export const quotaReturn = (now: Date, lang: string, count?: number) => {
  const reset = nextQuotaReset(now)
  const day = sameLocalDay(now, reset) ? 'today' : 'tomorrow'
  return {
    key: count ? `assistant.limitCard.${day}Count` : `assistant.limitCard.${day}`,
    time: format(reset, 'p', { locale: getDateLocale(lang) }),
    reset,
    ...(count ? { count } : {}),
  }
}

/** The last quota the service gave, for the account it gave it to. */
export type AssistantQuotaState = { uid: string; quota: StudyQuota } | null

export const assistantQuotaAtom = atom<AssistantQuotaState>(null)

/** Keeps what the service said the account may still ask: from the stream, a refusal, the route. */
export const recordAssistantQuota = (uid: string, quota: StudyQuota) =>
  getDefaultStore().set(assistantQuotaAtom, { uid, quota })

/**
 * The quota that holds now for this account, or null when it is unknown: none was received for
 * it, or the day it counted has ended.
 */
export const currentQuota = (
  state: AssistantQuotaState,
  uid: string | null | undefined,
  now: Date
): StudyQuota | null => {
  if (!state || !uid || state.uid !== uid) return null
  const ends = quotaEnd(state.quota)
  if (ends && now.getTime() >= Date.parse(ends)) return null
  return state.quota
}

/** When the quota stops holding: the day's reset, or the end of a pause of the free questions. */
export const quotaEnd = (quota: StudyQuota | null) =>
  quota?.kind === 'daily' ? quota.resetsAt : quota?.kind === 'paused' ? quota.resumesAt : null

/** The day the free questions resume, as the reader's calendar names it. */
export const resumeDate = (resumesAt: string, lang: string) =>
  format(new Date(resumesAt), lang === 'fr' ? 'do MMMM' : 'MMMM d', {
    locale: getDateLocale(lang),
  })

/**
 * Whether the free questions are paused for this account: the service says so, or refused a
 * question for it and has not said otherwise since.
 */
export const freeQuestionsPaused = (error: string, quota: StudyQuota | null) =>
  quota?.kind === 'paused' ||
  (error === 'assistant.freePaused' && quota?.kind !== 'daily' && quota?.kind !== 'unlimited')

/** What the line above the composer says, or null when it says nothing. */
export type QuotaLine =
  | { kind: 'remaining'; count: number }
  | { kind: 'none'; time: string }
  | { kind: 'paused'; date: string }

export const quotaLine = (quota: StudyQuota | null, lang: string): QuotaLine | null => {
  if (quota?.kind === 'paused') return { kind: 'paused', date: resumeDate(quota.resumesAt, lang) }
  if (quota?.kind !== 'daily') return null
  if (quota.remaining > 0) return { kind: 'remaining', count: quota.remaining }
  return {
    kind: 'none',
    time: format(new Date(quota.resetsAt), 'p', { locale: getDateLocale(lang) }),
  }
}

/**
 * Whether the assistant asks the reader to verify their address: the service says the account
 * waits for it, or refused a question for it and has not said otherwise since.
 */
export const asksEmailVerification = (error: string, quota: StudyQuota | null) =>
  quota?.kind === 'verify_email' ||
  (error === 'assistant.verifyEmail' && quota?.kind !== 'daily' && quota?.kind !== 'unlimited')
