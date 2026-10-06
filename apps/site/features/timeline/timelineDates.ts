import type { ResourceLanguage } from '../resources/publicSite'

/**
 * The dating of an event as the publication writes it. Years are negative before Christ.
 * A span may be left open (`1559-`) or run into what is still to come (`476-Future`).
 */
export type TimelineDates =
  | { kind: 'years'; start: number; end: number | 'open' | 'future' }
  | { kind: 'future' }
  | { kind: 'afterMillennium' }

type Era = 'BC' | 'AD'

const toYear = (digits: string, era: Era): number =>
  era === 'BC' ? -Number(digits) : Number(digits)

// There is no year zero.
const years = (start: number, end: number | 'open' | 'future'): TimelineDates | undefined =>
  start && end ? { kind: 'years', start, end } : undefined

/**
 * Reads the dating grammar of the Timeline publication, the same in every language:
 * `1444 BC`, `3954-3024 BC`, `56 AD`, `51-52 AD`, `89 BC-7 AD`, `1559-`, `476-Future`,
 * `539 BC-Future`, `Future` and `After Millenium`. Nothing is inferred from other wording.
 */
export const parseTimelineDates = (value: string): TimelineDates | undefined => {
  const text = value.trim()
  if (text === 'Future') return { kind: 'future' }
  if (/^After Mill?enn?ium$/u.test(text)) return { kind: 'afterMillennium' }

  const unbounded = /^(\d{1,4})(?: (BC|AD))?-(Future)?$/u.exec(text)
  if (unbounded) {
    const era = (unbounded[2] as Era | undefined) ?? 'AD'
    return years(toYear(unbounded[1], era), unbounded[3] ? 'future' : 'open')
  }

  const acrossEras = /^(\d{1,4}) BC-(\d{1,4}) AD$/u.exec(text)
  if (acrossEras) return years(toYear(acrossEras[1], 'BC'), toYear(acrossEras[2], 'AD'))

  // One era mark after a year or a span applies to both of its years.
  const sameEra = /^(\d{1,4})(?:-(\d{1,4}))? (BC|AD)$/u.exec(text)
  if (!sameEra) return undefined
  const era = sameEra[3] as Era
  return years(toYear(sameEra[1], era), toYear(sameEra[2] ?? sameEra[1], era))
}

// Undated events close their period: what is still to come, what follows the millennium,
// then any dating the grammar does not read. A year never has more than four digits.
const FUTURE_RANK = 10_000
const AFTER_MILLENNIUM_RANK = 10_001
const UNREAD_RANK = 10_002

/** Where a dating stands on the timeline: its first year, or its place after the years. */
export const timelineDatesRank = (value: string): number => {
  const dates = parseTimelineDates(value)
  if (!dates) return UNREAD_RANK
  if (dates.kind === 'future') return FUTURE_RANK
  if (dates.kind === 'afterMillennium') return AFTER_MILLENNIUM_RANK
  return dates.start
}

const LABELS = {
  fr: {
    BC: 'av. J.-C.',
    AD: 'ap. J.-C.',
    future: 'Futur',
    untilFuture: 'futur',
    afterMillennium: 'Après le millénium',
    from: 'À partir de {year}',
  },
  en: {
    BC: 'BC',
    AD: 'AD',
    future: 'Future',
    untilFuture: 'future',
    afterMillennium: 'After the Millennium',
    from: 'From {year}',
  },
} as const

/**
 * Writes a dating in the language of the page. The publication carries English era marks
 * in both languages; a dating outside its grammar is shown as written.
 */
export const formatTimelineDates = (value: string, language: ResourceLanguage): string => {
  const dates = parseTimelineDates(value)
  if (!dates) return value.trim()
  const labels = LABELS[language]
  if (dates.kind === 'future') return labels.future
  if (dates.kind === 'afterMillennium') return labels.afterMillennium

  const { start, end } = dates
  const era = (year: number) => (year < 0 ? labels.BC : labels.AD)
  const withEra = (year: number) => `${Math.abs(year)} ${era(year)}`
  if (end === 'open') return labels.from.replace('{year}', withEra(start))
  if (end === 'future') return `${withEra(start)} – ${labels.untilFuture}`
  if (end === start) return withEra(start)
  // Two years of one era share its mark, written once after the span.
  if (start < 0 === end < 0) return `${Math.abs(start)}–${Math.abs(end)} ${era(start)}`
  return `${withEra(start)} – ${withEra(end)}`
}
