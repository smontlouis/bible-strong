import { editorialHtmlToText } from '../resources/editorialHtml'
import { parseStrongCode } from './strongRoutes'

// A classical Strong number is the door readers know; the senses the lexicon tells apart
// under it are the precise entries. These rules decide which of the two a page, a list line
// or a sitemap names.

/**
 * Asks the lexicon list of the Resource API for every sense. Left to itself it names one
 * entry for those that share a person or a thing, as the workspace lists them. A service
 * older than the option ignores it and answers with that shorter list.
 */
export const EVERY_STRONG_SENSE = { identities: 'all' } as const

/** A sense as the lexicon lists it. */
export type StrongSenseRef = {
  code: string
  /** The classical number the sense is filed under. */
  classicCode: string
  gloss: string
  original: string
  transliteration: string
}

/** Reads a row of the lexicon into a sense; a row whose codes cannot be read is left out. */
export const toStrongSenseRef = (entry: {
  stepCode: string
  classicStrong: string
  gloss: string
  original: string
  transliteration: string
}): StrongSenseRef | undefined => {
  const code = parseStrongCode(entry.stepCode)?.code
  const classicCode = parseStrongCode(entry.classicStrong)?.code
  if (!code || !classicCode) return undefined
  return {
    code,
    classicCode,
    gloss: entry.gloss,
    original: entry.original,
    transliteration: entry.transliteration,
  }
}

/**
 * Whether a classical number has a page of its own, listing its senses. It does when the
 * lexicon tells several apart under it. A number that is itself the code of one of them
 * (`G5514` next to `G5514G`) keeps its address for that sense, whose page lists the others.
 */
export const hasStrongNumberPage = (
  classicCode: string,
  senses: readonly { code: string }[]
): boolean => senses.length > 1 && !senses.some(sense => sense.code === classicCode)

const byClassicCode = (senses: readonly StrongSenseRef[]): Map<string, StrongSenseRef[]> => {
  const numbers = new Map<string, StrongSenseRef[]>()
  for (const sense of senses) {
    numbers.set(sense.classicCode, [...(numbers.get(sense.classicCode) ?? []), sense])
  }
  return numbers
}

/**
 * The entry page of every classical number: the number itself where it has a page, its
 * senses otherwise. The senses of a number that has a page are reached from it.
 */
export const strongEntryPageCodes = (senses: readonly StrongSenseRef[]): string[] =>
  [...byClassicCode(senses)].flatMap(([classicCode, filed]) =>
    hasStrongNumberPage(classicCode, filed) ? [classicCode] : filed.map(sense => sense.code)
  )

export type StrongListLine = {
  /** What the line opens: a sense, or the number whose senses share the gloss. */
  code: string
  gloss: string
  original: string
  transliteration: string
  /** How many senses of the number the line stands for, when more than one. */
  senseCount?: number
}

const glossKey = (gloss: string): string => gloss.trim().toLocaleLowerCase()

/**
 * The lines of a lexicon list. The senses of one number that read the same (the thirty
 * entries named Zechariah) make one line, which opens the page of the number; a sense with a
 * gloss of its own keeps its line and opens its entry.
 */
export const groupStrongListLines = (senses: readonly StrongSenseRef[]): StrongListLine[] => {
  const groups = new Map<string, StrongSenseRef[]>()
  for (const sense of senses) {
    const key = `${sense.classicCode}\n${glossKey(sense.gloss)}`
    groups.set(key, [...(groups.get(key) ?? []), sense])
  }
  return [...groups.values()].flatMap((group): StrongListLine[] => {
    const [first] = group
    if (!first) return []
    if (!hasStrongNumberPage(first.classicCode, group)) {
      return group.map(({ code, gloss, original, transliteration }) => ({
        code,
        gloss,
        original,
        transliteration,
      }))
    }
    return [
      {
        code: first.classicCode,
        gloss: first.gloss,
        original: first.original,
        transliteration: first.transliteration,
        senseCount: group.length,
      },
    ]
  })
}

// A notice is cut where it starts a new line: a paragraph, a list item, a line break.
const NOTICE_BREAK = /<br\s*\/?>|<\/(?:p|div|li)>/giu
// The bold label some notices open their lines with, as in "<strong>Exact sense:</strong>".
const NOTICE_LABEL = /^\s*(?:<p[^>]*>\s*)?<(strong|b)>[^<]*:\s*<\/\1>/iu
// The number of an outline entry: "1)", "1a)", "2.".
const OUTLINE_MARKER = /^\d+[a-z]?\d*[).]\s*/iu

const plainKey = (text: string): string =>
  text
    .toLocaleLowerCase()
    .replace(/[\s.;:,!?]+$/u, '')
    .trim()

/**
 * The first line of a notice that says more than the gloss does. Notices open with the
 * gloss itself, an outline number or a label, none of which tells a sense apart.
 */
export const firstNoticeLine = (html: string | undefined, gloss: string): string | undefined => {
  for (const block of (html ?? '').split(NOTICE_BREAK)) {
    const line = editorialHtmlToText(block.replace(NOTICE_LABEL, ''))
      .replace(OUTLINE_MARKER, '')
      .replace(/\s*;$/u, '')
      .trim()
    if (line && plainKey(line) !== plainKey(gloss)) return line
  }
  return undefined
}

/**
 * What tells each sense of a number apart: who the person or the place is, or else the
 * first line of its own notice. A line several senses share, as the article of a Greek
 * word, tells nothing apart.
 */
export const strongSenseSummaries = (
  senses: readonly { brief?: string; noticeHtml?: string; gloss: string }[]
): (string | undefined)[] => {
  const lines = senses.map(sense => firstNoticeLine(sense.noticeHtml, sense.gloss))
  return senses.map((sense, index) => {
    const line = lines[index]
    const shared = lines.some((other, position) => position !== index && other === line)
    return sense.brief?.trim() || (shared ? undefined : line)
  })
}

/** The glosses of the senses of a number, each once, in the order of the senses. */
export const uniqueStrongGlosses = (senses: readonly { gloss: string }[]): string[] => {
  const seen = new Set<string>()
  return senses.flatMap(({ gloss }) => {
    const key = glossKey(gloss)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [gloss.trim()]
  })
}
