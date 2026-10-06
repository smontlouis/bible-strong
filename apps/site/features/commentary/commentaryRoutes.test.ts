import { describe, expect, it } from 'vitest'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildCommentaryPath,
  buildWebAppCommentaryUrl,
  commentaryRouteParams,
  commentarySectionAnchor,
  isCommentaryResourceSlug,
  parseCommentaryRoute,
  validateCommentarySearch,
} from './commentaryRoutes'

const chapter = { language: 'fr', resource: 'mhy-fr', book: 'john', chapter: '3' }

describe('Commentary public routes', () => {
  it('parses a chapter and a section of the ADR-0054 grammar', () => {
    expect(parseCommentaryRoute(chapter)).toEqual({
      language: 'fr',
      resource: 'mhy-fr',
      book: 43,
      chapter: 3,
    })
    expect(parseCommentaryRoute({ ...chapter, section: '1-21' })?.section).toBe('1-21')
    expect(parseCommentaryRoute({ ...chapter, section: '16-16-2' })?.section).toBe('16-16-2')
    expect(parseCommentaryRoute({ ...chapter, section: '0-0' })?.section).toBe('0-0')
  })

  it('reads any spelling of an OSIS book and of a chapter number', () => {
    expect(parseCommentaryRoute({ ...chapter, book: 'John' })?.book).toBe(43)
    expect(parseCommentaryRoute({ ...chapter, book: '1COR' })?.book).toBe(46)
    expect(parseCommentaryRoute({ ...chapter, book: 'tob' })?.book).toBe(67)
    expect(parseCommentaryRoute({ ...chapter, chapter: '03' })?.chapter).toBe(3)
  })

  it('rejects what the grammar does not describe', () => {
    for (const params of [
      { ...chapter, language: 'de' },
      { ...chapter, language: 'FR' },
      { ...chapter, resource: 'MHY' },
      { ...chapter, resource: 'a' },
      { ...chapter, resource: '../etc' },
      { ...chapter, book: 'jean' },
      { ...chapter, chapter: '0' },
      { ...chapter, chapter: '3a' },
      { ...chapter, chapter: '1000' },
      { ...chapter, section: '1' },
      { ...chapter, section: 'MHY-fr-43-3-1-21' },
      { ...chapter, section: '1-21-' },
      { ...chapter, section: '' },
    ]) {
      expect(parseCommentaryRoute(params)).toBeUndefined()
    }
  })

  it('accepts catalog Resource identities only as resource segments', () => {
    expect(isCommentaryResourceSlug('mhy-fr')).toBe(true)
    expect(isCommentaryResourceSlug('kd')).toBe(true)
    expect(isCommentaryResourceSlug('douay-rheims-notes')).toBe(true)
    expect(isCommentaryResourceSlug('K&D')).toBe(false)
    expect(isCommentaryResourceSlug(undefined)).toBe(false)
  })

  it('builds the list, commentary and chapter paths', () => {
    const location = { language: 'en', resource: 'barnes', book: 43, chapter: 3 } as const
    expect(buildCommentaryIndexPath('fr')).toBe('/commentary/fr')
    expect(buildCommentaryPath('en', 'barnes')).toBe('/commentary/en/barnes')
    expect(buildCommentaryChapterPath(location)).toBe('/commentary/en/barnes/john/3')
    expect(buildWebAppCommentaryUrl(location)).toBe(
      'https://web.bible-strong.app/commentary/en/barnes/john/3'
    )
  })

  it('numbers every page of a chapter but the first', () => {
    const location = { language: 'en', resource: 'egw-writings', book: 43, chapter: 3 } as const
    expect(buildCommentaryChapterPath(location, 1)).toBe('/commentary/en/egw-writings/john/3')
    expect(buildCommentaryChapterPath(location, 4)).toBe(
      '/commentary/en/egw-writings/john/3?page=4'
    )
  })

  it('spells the parameters of a parsed route canonically', () => {
    const route = parseCommentaryRoute({ ...chapter, book: 'JOHN', chapter: '03' })!
    expect(commentaryRouteParams(route)).toEqual(chapter)
  })

  it('refuses to build a path outside the grammar', () => {
    const location = { language: 'fr', resource: 'mhy-fr', book: 43, chapter: 3 } as const
    expect(() => buildCommentaryChapterPath({ ...location, book: 99 })).toThrow(
      'COMMENTARY_ROUTE_INVALID'
    )
    expect(() => buildCommentaryChapterPath({ ...location, resource: 'Not A Slug' })).toThrow(
      'COMMENTARY_ROUTE_INVALID'
    )
  })

  it('anchors a section in its chapter page', () => {
    expect(commentarySectionAnchor('1-21')).toBe('v1-21')
    expect(commentarySectionAnchor('16-16-2')).toBe('v16-16-2')
  })
})

describe('Commentary page numbers', () => {
  it('reads a page number written as a number or as text', () => {
    expect(validateCommentarySearch({ page: 2 })).toEqual({ page: 2 })
    expect(validateCommentarySearch({ page: '3' })).toEqual({ page: 3 })
    expect(validateCommentarySearch({ page: 1 })).toEqual({ page: 1 })
  })

  it('reads anything else as the first page', () => {
    for (const page of [0, -1, 1.5, 10000, 'abc', '', null, undefined, [2]]) {
      expect(validateCommentarySearch({ page })).toEqual({})
    }
    expect(validateCommentarySearch({ other: 2 })).toEqual({})
  })
})
