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
}

/** Lexicon › the letter the entry is filed under › the entry. */
export const strongEntryBreadcrumbs = ({
  language,
  code,
  lexicalLanguage,
  gloss,
}: StrongEntryRef): Breadcrumb[] => {
  const letter = strongGlossLetter(gloss)
  return [
    ...(letter ? strongLetterBreadcrumbs(language, lexicalLanguage, letter) : [indexCrumb(language)]),
    { label: `Strong ${displayStrongCode(code)}`, path: buildStrongPath(language, code) },
  ]
}

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
