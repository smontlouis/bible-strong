import { format } from 'date-fns'
import { getDateLocale } from '~helpers/languageUtils'

/** The daily quota of the assistant starts again at midnight UTC (the Worker counts by UTC day). */
export const nextQuotaReset = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** When the reader's questions come back, in their own time: today or tomorrow, at what hour. */
export const quotaReturn = (now: Date, lang: string) => {
  const reset = nextQuotaReset(now)
  return {
    key: sameLocalDay(now, reset) ? 'assistant.limitCard.today' : 'assistant.limitCard.tomorrow',
    time: format(reset, 'p', { locale: getDateLocale(lang) }),
    reset,
  }
}
