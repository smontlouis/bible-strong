import {
  getDisplayedStrongIdentities,
  type StrongIdentity,
} from '@bible-strong/resource-domain/strong-identities'
import * as z from 'zod/v4'
import type { Lexicon } from '../cards/types'
import { StudyError } from '../study'

export type StrongCode = {
  /** The entry as the lexicon names it: `G0026`, `H0430G`. The case of a suffix matters. */
  code: string
  /** The classical number as it is printed: `G26`, `H430`. */
  label: string
  lexicon: Lexicon
}

const CODE_PATTERN = /^(?:strong(?:'|’)?s?)?[\s#:]*([HG])[\s-]*0*(\d{1,5})([A-Za-z]{0,3})$/iu

/** Reads a Strong number however it is written: `G26`, `g0026`, `H430G`, `Strong's H 430`. */
export const parseStrongCode = (value: string): StrongCode | undefined => {
  const match = CODE_PATTERN.exec(value.trim())
  if (!match) return undefined
  const prefix = match[1]!.toUpperCase()
  const number = Number(match[2])
  if (!number) return undefined
  return {
    code: `${prefix}${String(number).padStart(4, '0')}${match[3]}`,
    label: `${prefix}${number}`,
    lexicon: prefix === 'H' ? 'hebrew' : 'greek',
  }
}

export const requireStrongCode = (value: string): StrongCode => {
  const code = parseStrongCode(value)
  if (!code) {
    throw new StudyError(
      `"${value}" is not a Strong number. Write H for Hebrew or G for Greek, then the number: ` +
        'H430, G26. search_strong_lexicon finds the number of a word.'
    )
  }
  return code
}

/** Whether two spellings name the same entry: indexes do not all pad their codes. */
export const sameStrongCode = (left: string, right: string): boolean =>
  parseStrongCode(left)?.code === parseStrongCode(right)?.code

/**
 * The entry a tagged word opens: of the identities it carries, the most precise one of its
 * first family, as the public site links it.
 */
export const displayedStrongCode = (identities: readonly StrongIdentity[]): StrongCode | undefined => {
  const known = identities.filter(identity => identity.kind !== 'ustrong')
  const displayed = getDisplayedStrongIdentities(known)[0]
  return displayed ? parseStrongCode(displayed.code) : undefined
}

/** A suffix names a sense in one letter case only; the lexicon is asked for each. */
export const strongCodeSpellings = (code: string): string[] => {
  const number = code.replace(/[A-Za-z]+$/u, '')
  const suffix = code.slice(number.length)
  return [...new Set([code, `${number}${suffix.toUpperCase()}`, `${number}${suffix.toLowerCase()}`])]
}

// Any book of the matching testament anchors a lookup across the whole index.
export const anchorBook = (lexicon: Lexicon): number => (lexicon === 'hebrew' ? 1 : 40)

export const strongCodeInput = z
  .string()
  .min(2)
  .max(24)
  .describe(
    'A Strong number: H for Hebrew or G for Greek, then the number, such as "H430" or "G26". ' +
      'A letter may follow to name one sense ("H1254A"), as other tools return it.'
  )
