import {
  COMMENTARY_CATALOG,
  type CommentaryCatalogEntry,
} from '@bible-strong/resource-catalog/commentaries'
import { RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import { otherResourceLanguage } from './commentaryRoutes'

/**
 * A commentary as a page of the site presents it. This module reads the shared catalog,
 * which the pages only reach through their server functions.
 */
export type Commentary = {
  /** The catalog Resource identity, which is also the path segment (ADR-0054). */
  id: string
  /** The identity of the publication in the Resource API. */
  publicationId: string
  title: string
  author: string
  /** In the language of the page; a commentary may have none in a language. */
  description: string
  /** The attribution and licence the catalog gives for the commentary. */
  rights: string
  /**
   * False for a work whose holder reserves all rights: it stays readable, as in the study
   * workspace, but is kept out of search indexes and sitemaps.
   */
  indexable: boolean
  /** The Resource identity of the same work in the other language, when it has one. */
  counterpartId?: string
}

// One work the catalog lists as an edition per language: Matthew Henry's concise commentary
// and its French translation.
const TRANSLATED_EDITIONS: Record<string, string> = { 'mhy-fr': 'mhcc', mhcc: 'mhy-fr' }

// The catalog writes authors as the French study workspace names them. These are the ones
// that read differently in English.
const ENGLISH_AUTHORS: Record<string, string> = {
  abbott: 'John S. C. Abbott and Jacob Abbott',
  calvin: 'John Calvin',
  'catena-aurea': 'Thomas Aquinas (compiler)',
  'douay-rheims-notes': 'English College of Douai–Rheims',
  'family-notes': 'Justin Edwards and others',
  'fourfold-gospel': 'J. W. McGarvey and Philip Y. Pendleton',
  'geneva-notes': 'Translators of the Geneva Bible',
  kd: 'C. F. Keil and F. Delitzsch',
  mhm: 'Matthew Henry; adapted by STEPBible',
  'rashi-en': 'Rashi',
  sdabc: 'Francis D. Nichol (ed.) and contributors',
}

const RESERVED_RIGHTS = /tous droits réservés/iu

// The two phrases catalog notices are built with; holders and licence names stay as written.
const ENGLISH_RIGHTS: readonly (readonly [string, string])[] = [
  ['Domaine public', 'Public domain'],
  ['tous droits réservés', 'all rights reserved'],
]

/** The attribution of a commentary, with its common phrases in the language of the page. */
export const localizeCommentaryRights = (rights: string, language: ResourceLanguage): string =>
  language === 'fr'
    ? rights
    : ENGLISH_RIGHTS.reduce((notice, [french, english]) => notice.replace(french, english), rights)

const present = (entry: CommentaryCatalogEntry, language: ResourceLanguage): Commentary => ({
  id: entry.id,
  publicationId: entry.publicationId,
  title: entry.title,
  author: (language === 'en' && ENGLISH_AUTHORS[entry.id]) || entry.author,
  description: entry.description[language] ?? '',
  rights: localizeCommentaryRights(entry.rights, language),
  indexable: !RESERVED_RIGHTS.test(entry.rights),
  // A work published in both languages under one identity is its own counterpart.
  counterpartId: entry.languages.includes(otherResourceLanguage(language))
    ? entry.id
    : TRANSLATED_EDITIONS[entry.id],
})

/** The commentaries published in a language, in catalog order. */
export const listCommentaries = (language: ResourceLanguage): Commentary[] =>
  COMMENTARY_CATALOG.filter(entry => entry.languages.includes(language)).map(entry =>
    present(entry, language)
  )

export const findCommentary = (
  language: ResourceLanguage,
  id: string | undefined
): Commentary | undefined => listCommentaries(language).find(commentary => commentary.id === id)

/** The same work in the other language. */
export const findCommentaryCounterpart = (
  commentary: Commentary,
  language: ResourceLanguage
): Commentary | undefined =>
  findCommentary(otherResourceLanguage(language), commentary.counterpartId)

/** Every commentary in every language it is published in. */
export const listCommentaryProjections = (): { language: ResourceLanguage; commentary: Commentary }[] =>
  RESOURCE_LANGUAGES.flatMap(language =>
    listCommentaries(language).map(commentary => ({ language, commentary }))
  )
