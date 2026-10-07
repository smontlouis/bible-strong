import type { ResourceLanguage } from '../resources/publicSite'
import type { Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import {
  buildStrongConcordancePath,
  buildStrongIndexPath,
  buildStrongLetterPath,
  buildStrongPath,
  displayStrongCode,
  strongGlossLetter,
  type StrongLexicalLanguage,
} from './strongRoutes'

const LEXICON_LABELS: Record<ResourceLanguage, Record<StrongLexicalLanguage, string>> = {
  fr: { hebrew: 'Lexique hébreu', greek: 'Lexique grec' },
  en: { hebrew: 'Hebrew lexicon', greek: 'Greek lexicon' },
}

const indexCrumb = (language: ResourceLanguage): Breadcrumb => ({
  label: resourceSection('strong').label[language],
  path: buildStrongIndexPath(language),
})

/** Lexicon › the letter of a lexicon. */
export const strongLetterBreadcrumbs = (
  language: ResourceLanguage,
  lexicon: StrongLexicalLanguage,
  letter: string
): Breadcrumb[] => [
  indexCrumb(language),
  {
    label: `${LEXICON_LABELS[language][lexicon]} — ${letter.toUpperCase()}`,
    path: buildStrongLetterPath(language, lexicon, letter),
  },
]

type StrongEntryRef = {
  language: ResourceLanguage
  code: string
  lexicalLanguage: StrongLexicalLanguage
  gloss: string
  /** The page of the classical number, where it lists the entry among its senses. */
  number?: { code: string }
}

const entryCrumb = (language: ResourceLanguage, code: string): Breadcrumb => ({
  label: `Strong ${displayStrongCode(code)}`,
  path: buildStrongPath(language, code),
})

/** Lexicon › the letter the entry is filed under › its number, when it has a page › the entry. */
export const strongEntryBreadcrumbs = ({
  language,
  code,
  lexicalLanguage,
  gloss,
  number,
}: StrongEntryRef): Breadcrumb[] => {
  const letter = strongGlossLetter(gloss)
  return [
    ...(letter ? strongLetterBreadcrumbs(language, lexicalLanguage, letter) : [indexCrumb(language)]),
    ...(number ? [entryCrumb(language, number.code)] : []),
    entryCrumb(language, code),
  ]
}

/** Lexicon › the letter its first sense is filed under › the number. */
export const strongNumberBreadcrumbs = ({
  language,
  code,
  lexicalLanguage,
  glosses,
}: {
  language: ResourceLanguage
  code: string
  lexicalLanguage: StrongLexicalLanguage
  glosses: readonly string[]
}): Breadcrumb[] =>
  strongEntryBreadcrumbs({ language, code, lexicalLanguage, gloss: glosses[0] ?? '' })

/** Lexicon › the entry › its concordance. */
export const strongConcordanceBreadcrumbs = ({
  language,
  code,
  page,
}: {
  language: ResourceLanguage
  code: string
  page: number
}): Breadcrumb[] => [
  indexCrumb(language),
  { label: `Strong ${displayStrongCode(code)}`, path: buildStrongPath(language, code) },
  {
    label: `Concordance${page > 1 ? ` – page ${page}` : ''}`,
    path: buildStrongConcordancePath(language, code, { page }),
  },
]
