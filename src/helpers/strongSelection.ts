import type { SelectedCode } from '~common/types'
import { getStrongReferenceNumber } from './strongIdentities'

export type StrongSelection = SelectedCode & {
  version: string
  references: string[]
}

const normalizeStrongCode = (reference: string, book: number): string | undefined => {
  const code = reference.trim()
  if (/^[HG]\d+[A-Z]*$/iu.test(code)) return code.toUpperCase()
  if (/^\d+$/u.test(code)) return `${book <= 39 ? 'H' : 'G'}${code}`
  return undefined
}

export const createStrongSelection = (
  references: readonly string[],
  bookValue: string | number,
  versionValue: string
): StrongSelection | undefined => {
  const book = Number(bookValue)
  const version = versionValue.trim()
  if (!Number.isInteger(book) || book < 1 || book > 66) return undefined
  if (!version) return undefined

  const normalizedReferences = references
    .flatMap(reference => {
      const normalized = normalizeStrongCode(reference, book)
      return normalized ? [normalized] : []
    })
    .filter((reference, index, allReferences) => allReferences.indexOf(reference) === index)
  const reference = getStrongReferenceNumber(normalizedReferences[0] ?? '')

  if (!reference || normalizedReferences.length === 0) return undefined

  return {
    book,
    reference,
    references: normalizedReferences,
    version,
  }
}

export const getStrongSelectionPayload = (payload: unknown): StrongSelection | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined

  const candidate = payload as Record<string, unknown>
  if (!Array.isArray(candidate.references)) return undefined

  const references = candidate.references.filter(
    (reference): reference is string => typeof reference === 'string'
  )
  if (references.length !== candidate.references.length) return undefined
  if (typeof candidate.book !== 'number' && typeof candidate.book !== 'string') return undefined
  if (typeof candidate.version !== 'string') return undefined

  return createStrongSelection(references, candidate.book, candidate.version)
}
