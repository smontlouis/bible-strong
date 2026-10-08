import type { ResourceLanguage } from '../resources/publicSite'
import type { Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryTermPath,
  buildDictionaryWorkPath,
} from './dictionaryRoutes'

type WorkRef = { id: string; abbreviation: string }

/** Dictionary › the work. */
export const dictionaryWorkBreadcrumbs = (
  language: ResourceLanguage,
  work: WorkRef
): Breadcrumb[] => [
  {
    label: resourceSection('dictionary').label[language],
    path: buildDictionaryIndexPath(language),
  },
  { label: work.abbreviation, path: buildDictionaryWorkPath(language, work.id) },
]

/** Dictionary › the work › the letter, then the page of its list when it has several. */
export const dictionaryLetterBreadcrumbs = (
  language: ResourceLanguage,
  work: WorkRef,
  letter: string,
  page = 1
): Breadcrumb[] => [
  ...dictionaryWorkBreadcrumbs(language, work),
  {
    label: `${letter.toUpperCase()}${page > 1 ? ` – page ${page}` : ''}`,
    path: buildDictionaryLetterPath(language, work.id, letter, page),
  },
]

/** Dictionary › the work › the letter the article is filed under › the article. */
export const dictionaryEntryBreadcrumbs = ({
  language,
  work,
  id,
  word,
  letter,
}: {
  language: ResourceLanguage
  work: WorkRef
  id: number
  word: string
  letter?: string
}): Breadcrumb[] => [
  ...(letter
    ? dictionaryLetterBreadcrumbs(language, work, letter)
    : dictionaryWorkBreadcrumbs(language, work)),
  { label: word, path: buildDictionaryEntryPath({ language, work: work.id, entryId: id, word }) },
]

/** Dictionary › the term. */
export const dictionaryTermBreadcrumbs = ({
  language,
  word,
}: {
  language: ResourceLanguage
  word: string
}): Breadcrumb[] => [
  {
    label: resourceSection('dictionary').label[language],
    path: buildDictionaryIndexPath(language),
  },
  { label: word, path: buildDictionaryTermPath(language, word) },
]
