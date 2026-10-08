import {
  createStrongIdentity,
  getStrongReferenceNumber,
  type StrongIdentity,
} from '@bible-strong/resource-domain/strong-identities'
import { WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'

export type StrongLexicalLanguage = 'hebrew' | 'greek'

const lexicalLanguageOf = (code: string): StrongLexicalLanguage =>
  code[0]?.toLowerCase() === 'h' ? 'hebrew' : 'greek'

/**
 * Same code grammar as the Expo public route (ADR-0053). The suffix case is part of the
 * identity: `H1254a` and `H1254A` are different entries.
 */
export const parseStrongCode = (raw: string | undefined): StrongIdentity | undefined => {
  if (!raw || !/^[hg]\d+[a-z]*$/iu.test(raw)) return undefined
  return createStrongIdentity(raw, lexicalLanguageOf(raw))
}

export const strongLexicalLanguage = (code: string): StrongLexicalLanguage => lexicalLanguageOf(code)

export const strongCodeSlug = (code: string): string => `${code[0]?.toLowerCase()}${code.slice(1)}`

/** `H0430` reads as `H430`; a sense suffix is kept (`H0430G` reads as `H430G`). */
export const displayStrongCode = (code: string): string => {
  const number = getStrongReferenceNumber(code)
  if (!number) return code
  return `${code[0]?.toUpperCase()}${number}${code.replace(/^[HGhg]\d+/u, '')}`
}

/** The classical number a code belongs to: `H1254B` reads as `H1254`. */
export const displayStrongNumber = (code: string): string => {
  const number = getStrongReferenceNumber(code)
  return number ? `${code[0]?.toUpperCase()}${number}` : code
}

/**
 * How a title names an entry: the classical number readers search for, then the sense where
 * the lexicon tells several apart, so that two senses of one number never share a title.
 */
export const displayStrongTitleCode = (code: string): string => {
  const number = displayStrongNumber(code)
  const sense = displayStrongCode(code)
  return sense === number ? number : `${number} (${sense})`
}

/**
 * A transliteration as it is typed in a search: its first spelling, without the marks a
 * keyboard does not have (`'ĕlôhîym` reads `Elohiym`).
 */
export const plainTransliteration = (transliteration: string): string => {
  const plain = (transliteration.trim().split(/\s+/u)[0] ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}-]/gu, '')
  return plain ? `${plain[0]?.toUpperCase()}${plain.slice(1)}` : ''
}

export const buildStrongPath = (language: ResourceLanguage, code: string): string => {
  const identity = parseStrongCode(code)
  if (!identity) throw new Error('STRONG_ROUTE_INVALID')
  return `/strong/${language}/${strongCodeSlug(identity.code)}`
}

export const STRONG_LEXICONS = ['hebrew', 'greek'] as const

export const isStrongLexicon = (value: string | undefined): value is StrongLexicalLanguage =>
  value === 'hebrew' || value === 'greek'

export const STRONG_LETTERS = [...'abcdefghijklmnopqrstuvwxyz']

/**
 * The letter an entry is filed under: the first letter of its gloss without its accent.
 * A gloss starting with a digit or a sign is not filed.
 */
export const strongGlossLetter = (gloss: string): string | undefined => {
  const letter = gloss.trim().normalize('NFD')[0]?.toLowerCase()
  return letter && STRONG_LETTERS.includes(letter) ? letter : undefined
}

/** The lexicon of a language: its Hebrew and Greek entries, filed by letter. */
export const buildStrongIndexPath = (language: ResourceLanguage): string => `/strong/${language}`

export const buildStrongLetterPath = (
  language: ResourceLanguage,
  lexicon: StrongLexicalLanguage,
  letter: string
): string => `/strong/${language}/${lexicon}/${letter}`

/**
 * The occurrences of an entry, a numbered page at a time, optionally restricted to one
 * book (OSIS slug). The first page has no number.
 */
export const buildStrongConcordancePath = (
  language: ResourceLanguage,
  code: string,
  { book, page = 1 }: { book?: string; page?: number } = {}
): string =>
  `${buildStrongPath(language, code)}/concordance${page > 1 ? `/${page}` : ''}${
    book ? `?book=${book}` : ''
  }`

/** The study workspace keeps the language-less route of ADR-0053. */
export const buildWebAppStrongUrl = (code: string): string => {
  const identity = parseStrongCode(code)
  if (!identity) throw new Error('STRONG_ROUTE_INVALID')
  return `${WEB_APP_ORIGIN}/strong/${strongCodeSlug(identity.code)}`
}
