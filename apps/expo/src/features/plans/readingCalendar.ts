import type { Plan, ReadingSlice } from '~common/types'
import spurgeonCalendar from './spurgeonCalendar.json'
import houstinCalendar from './houstinCalendar.json'
import houstinSupplementSource from './houstinSupplements.json'
import { meditationSupplements } from './meditationSupplements'

export type EditorialKind = 'reading-plan' | 'daily-meditation'

/** Legacy labels are presentation text, not the TypeScript enum stored by older clients. */
export const getEditorialKind = (
  content: Pick<Plan, 'type' | 'kind'>
): EditorialKind | undefined => {
  if (content.kind === 'reading-plan' || content.kind === 'daily-meditation') return content.kind
  if (['reading-plan', 'yearly', 'Plan annuel', 'Yearly Plan'].includes(content.type))
    return 'reading-plan'
  if (['meditation', 'Livre de méditation', 'Meditation Book'].includes(content.type))
    return 'daily-meditation'
  return undefined
}

const pad = (value: number) => String(value).padStart(2, '0')
export const toCivilDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** UTC is only an arithmetic representation of civil dates, never a timezone conversion. */
const civilDay = (value: string): number | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return undefined
  return date.getTime() / 86_400_000
}

export const isCivilDate = (value: string): boolean => civilDay(value) !== undefined

export const getScheduledPlanDay = (startDate: string, date: string): number | undefined => {
  const start = civilDay(startDate)
  const current = civilDay(date)
  return start === undefined || current === undefined ? undefined : current - start + 1
}

export const getPlanDayDate = (startDate: string, day: number): string | undefined => {
  const start = civilDay(startDate)
  if (start === undefined || !Number.isInteger(day) || day < 1) return undefined
  return new Date((start + day - 1) * 86_400_000).toISOString().slice(0, 10)
}

const months = [
  ['janvier', 'january'],
  ['fevrier', 'february'],
  ['mars', 'march'],
  ['avril', 'april'],
  ['mai', 'may'],
  ['juin', 'june'],
  ['juillet', 'july'],
  ['aout', 'august'],
  ['septembre', 'september'],
  ['octobre', 'october'],
  ['novembre', 'november'],
  ['decembre', 'december'],
]

/** Parse the explicit date label; never infer an editorial date from a numeric content ID. */
export const getMeditationDateKey = (
  reading: Pick<ReadingSlice, 'title' | 'calendarDate'>
): string | undefined => {
  if (reading.calendarDate === null) return undefined
  if (reading.calendarDate !== undefined)
    return isCivilDate(`2024-${reading.calendarDate}`) ? reading.calendarDate : undefined
  const title = (reading.title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  for (const [index, names] of months.entries()) {
    const monthPattern = names.join('|')
    const dayFirst = title.match(new RegExp(`(?:^|[ ,])([0-9]{1,2})(?:er)? (${monthPattern})$`))
    const monthFirst = title.match(new RegExp(`(?:^|[ ,])(${monthPattern}) ([0-9]{1,2})$`))
    const day = Number(dayFirst?.[1] ?? monthFirst?.[2])
    if (day && isCivilDate(`2024-${pad(index + 1)}-${pad(day)}`))
      return `${pad(index + 1)}-${pad(day)}`
  }
  return undefined
}

export type MeditationLookup =
  | { status: 'available'; reading: ReadingSlice }
  | { status: 'missing' | 'ambiguous' | 'invalid-date' }

export const getMeditationTitle = (reading: Pick<ReadingSlice, 'title'>): string | undefined => {
  const title = reading.title?.trim()
  if (!title) return undefined
  const separator = title.lastIndexOf(',')
  return separator >= 0 && getMeditationDateKey({ title: title.slice(separator + 1).trim() })
    ? title.slice(0, separator).trim()
    : title
}

type MeditationCollection = Pick<Plan, 'sections'> & Partial<Pick<Plan, 'id' | 'lastUpdate'>>

/** Apply an audited correction only while its original title still identifies the legacy entry. */
export const getResolvedMeditationDate = (
  plan: Pick<MeditationCollection, 'id'>,
  reading: ReadingSlice
): string | null | undefined => {
  if (reading.calendarDate !== undefined)
    return reading.calendarDate === null ? null : getMeditationDateKey(reading)
  const correction =
    plan.id === 'ltdlf'
      ? spurgeonCalendar[reading.id as keyof typeof spurgeonCalendar]
      : plan.id === '365j'
        ? houstinCalendar[reading.id as keyof typeof houstinCalendar]
        : undefined
  return correction && correction.legacyTitle === reading.title
    ? correction.date
    : getMeditationDateKey(reading)
}

const houstinSupplements = {
  ...houstinSupplementSource,
  entries: houstinSupplementSource.entries.map(reading => ({
    ...reading,
    slices: reading.slices.map(slice => ({ ...slice, type: 'Text' as const })),
  })),
}

export const getMeditationReadings = (plan: MeditationCollection): ReadingSlice[] => {
  const readings = plan.sections.flatMap(section => section.readingSlices)
  const spurgeon = plan.id ? meditationSupplements[plan.id] : undefined
  const supplement =
    plan.id === '365j'
      ? houstinSupplements
      : spurgeon
        ? { ...spurgeon, entries: [spurgeon.entry] }
        : undefined
  if (
    !supplement ||
    readings.length < 365 ||
    (plan.lastUpdate !== undefined && String(plan.lastUpdate) !== supplement.legacyLastUpdate) ||
    !supplement.anchors.every(anchor =>
      readings.some(
        reading => reading.id === anchor.id && getMeditationTitle(reading) === anchor.title
      )
    )
  )
    return readings
  const additions = supplement.entries.filter(
    entry =>
      !readings.some(
        reading =>
          reading.id === entry.id || getResolvedMeditationDate(plan, reading) === entry.calendarDate
      )
  )
  return [...readings, ...additions]
}

/** Read-time projection: never rewrite cached publisher content or completion identifiers. */
export const normalizeMeditationCollection = (plan: Plan): Plan => {
  if (getEditorialKind(plan) !== 'daily-meditation') return plan
  const readings = getMeditationReadings(plan)
  const groups = new Map<string, ReadingSlice[]>()
  const dateFormatter = new Intl.DateTimeFormat(plan.lang, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const monthFormatter = new Intl.DateTimeFormat(plan.lang, { month: 'long', timeZone: 'UTC' })
  for (const reading of readings) {
    const date = getResolvedMeditationDate(plan, reading)
    const group = date ? date.slice(0, 2) : 'complementary'
    const title = getMeditationTitle(reading)
    const label = date ? dateFormatter.format(new Date(`2024-${date}T12:00:00Z`)) : undefined
    const normalized =
      date !== undefined
        ? {
            ...reading,
            calendarDate: date,
            title: label ? `${title ? `${title}, ` : ''}${label}` : title,
          }
        : reading
    groups.set(group, [...(groups.get(group) ?? []), normalized])
  }
  const usedSectionIds = new Set<string>()
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entries]) => {
      const original = plan.sections.find(
        section =>
          !usedSectionIds.has(section.id) &&
          section.readingSlices.some(
            reading => getMeditationDateKey(reading)?.slice(0, 2) === month
          )
      )
      const id = original?.id ?? `${plan.id}-${month}`
      usedSectionIds.add(id)
      const title =
        month === 'complementary'
          ? plan.lang === 'fr'
            ? 'Lectures complémentaires'
            : 'Additional readings'
          : monthFormatter.format(new Date(`2024-${month}-01T12:00:00Z`))
      return {
        ...original,
        id,
        title,
        subTitle: original?.subTitle ?? '',
        readingSlices: entries.sort((a, b) =>
          (a.calendarDate ?? '').localeCompare(b.calendarDate ?? '')
        ),
      }
    })
  return { ...plan, sections }
}

export const findMeditationForDate = (
  plan: MeditationCollection,
  date: string
): MeditationLookup => {
  if (!isCivilDate(date)) return { status: 'invalid-date' }
  const matches = getMeditationReadings(plan).filter(
    reading => getResolvedMeditationDate(plan, reading) === date.slice(5)
  )
  if (matches.length > 1) return { status: 'ambiguous' }
  return matches[0] ? { status: 'available', reading: matches[0] } : { status: 'missing' }
}

/** Preserve the opening quotation verbatim, removing only standalone known publisher locators. */
export const getMeditationOpening = (reading: Pick<ReadingSlice, 'slices'>) => {
  const openings = reading.slices.filter(
    block => block.type === 'Text' && block.subType === 'devotional'
  )
  if (openings.length !== 1 || openings[0].type !== 'Text') return undefined
  const source = openings[0].description.trim()
  const lines = source.split(/\r?\n/)
  const citations = lines.filter(line =>
    /^(?:AD|CTr|CC|AG|LVH|PG|FLB|VRP)\s+\d+\.\d+\s*$/.test(line.trim())
  )
  return {
    text: lines
      .filter(line => !citations.includes(line))
      .join('\n')
      .trim(),
    editorialCitation: citations.join('\n'),
    source,
  }
}
