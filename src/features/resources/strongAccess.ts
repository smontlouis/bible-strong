import { StrongReference } from '~common/types'
import type { DatabaseError } from '~helpers/catchDatabaseError'
import { getDefaultStore } from 'jotai/vanilla'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { StrongIdentity } from '~helpers/strongIdentities'
import {
  localStrongLexiconAccess,
  type StrongLexiconEntry,
  type StrongLexiconSearchResult,
} from './strongLexiconAccess'
export { getStrongReferenceFamily, type StrongReferenceFamily } from './strongAccessModel'

export type LexiqueGrecRow = Pick<StrongReference, 'Code' | 'Grec' | 'Mot'> & {
  lexiqueType: 'Grec'
}

export type LexiqueHebreuRow = Pick<StrongReference, 'Code' | 'Hebreu' | 'Mot'> & {
  lexiqueType: 'Hébreu'
}

export type LexiqueRow = LexiqueGrecRow | LexiqueHebreuRow

const getResourceLanguage = () => getDefaultStore().get(resourcesLanguageAtom).STRONG

const toIdentity = (reference: string, book: number): StrongIdentity => {
  const normalized = reference.trim().toUpperCase()
  const code = /^[HG]/u.test(normalized)
    ? normalized
    : `${book <= 39 ? 'H' : 'G'}${String(Number(normalized)).padStart(4, '0')}`
  return {
    kind: /^[HG]\d+[A-Z]+$/u.test(code) ? 'dstrong' : 'strong',
    code,
  }
}

const toLegacyReference = (entry: StrongLexiconEntry): StrongReference => ({
  Hebreu: entry.language === 'hebrew' ? entry.original : '',
  Grec: entry.language === 'greek' ? entry.original : '',
  Mot: entry.gloss,
  Code: String(entry.baseCode),
  Phonetique: entry.transliteration,
  Definition: entry.definitionHtml ?? '',
  Type: entry.morphology?.meaning ?? '',
  LSG: '',
  Origine: '',
  date: '',
  book: entry.language === 'hebrew' ? '1' : '40',
})

const toLexiqueRow = (entry: StrongLexiconSearchResult): LexiqueRow =>
  entry.language === 'greek'
    ? {
        Code: String(Number(entry.classicStrong.slice(1))),
        Grec: entry.original,
        Mot: entry.gloss,
        lexiqueType: 'Grec',
      }
    : {
        Code: String(Number(entry.classicStrong.slice(1))),
        Hebreu: entry.original,
        Mot: entry.gloss,
        lexiqueType: 'Hébreu',
      }

const loadReference = async (
  reference: string,
  book: number
): Promise<StrongReference | undefined> => {
  const entry = await localStrongLexiconAccess.loadEntry(
    toIdentity(reference, book),
    getResourceLanguage()
  )
  return entry ? toLegacyReference(entry) : undefined
}

const loadReferences = async (
  references: string[],
  book: number
): Promise<StrongReference[] | string[]> => {
  const entries = await Promise.all(references.map(reference => loadReference(reference, book)))
  return entries.every((entry): entry is StrongReference => Boolean(entry)) ? entries : references
}

const listLexiconByLetter = async (letter: string): Promise<LexiqueRow[]> => {
  const normalizedLetter = letter.trim().toLocaleLowerCase()
  const entries = await localStrongLexiconAccess.search(letter, getResourceLanguage(), 500)
  return entries
    .filter(entry => entry.gloss.toLocaleLowerCase().startsWith(normalizedLetter))
    .map(toLexiqueRow)
}

const searchLexicon = async (searchValue: string): Promise<LexiqueRow[]> =>
  (await localStrongLexiconAccess.search(searchValue, getResourceLanguage(), 200)).map(toLexiqueRow)

const loadRandomReference = async (book: number): Promise<StrongReference | undefined> => {
  const result = await localStrongLexiconAccess.random(
    book <= 39 ? 'hebrew' : 'greek',
    getResourceLanguage()
  )
  if (!result) return undefined
  return loadReference(result.stepCode, book)
}

export type StrongAccess = {
  loadReference: (
    reference: string,
    book: number
  ) => Promise<StrongReference | DatabaseError | undefined>
  loadReferences: (
    references: string[],
    book: number
  ) => Promise<StrongReference[] | string[] | DatabaseError>
  listLexiconByLetter: (letter: string) => Promise<LexiqueRow[] | DatabaseError>
  searchLexicon: (searchValue: string) => Promise<LexiqueRow[] | DatabaseError>
  loadRandomReference: (book: number) => Promise<StrongReference | DatabaseError | undefined>
}

export const localStrongAccess: StrongAccess = {
  loadReference,
  loadReferences,
  listLexiconByLetter,
  searchLexicon,
  loadRandomReference,
}
