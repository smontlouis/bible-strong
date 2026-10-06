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

export const buildStrongPath = (language: ResourceLanguage, code: string): string => {
  const identity = parseStrongCode(code)
  if (!identity) throw new Error('STRONG_ROUTE_INVALID')
  return `/strong/${language}/${strongCodeSlug(identity.code)}`
}

/** Every occurrence of an entry, optionally restricted to one book (OSIS slug). */
export const buildStrongConcordancePath = (
  language: ResourceLanguage,
  code: string,
  bookSlug?: string
): string =>
  `${buildStrongPath(language, code)}/concordance${bookSlug ? `?book=${bookSlug}` : ''}`

/** The study workspace keeps the language-less route of ADR-0053. */
export const buildWebAppStrongUrl = (code: string): string => {
  const identity = parseStrongCode(code)
  if (!identity) throw new Error('STRONG_ROUTE_INVALID')
  return `${WEB_APP_ORIGIN}/strong/${strongCodeSlug(identity.code)}`
}
