import { describe, expect, it } from 'vitest'
import { buildBibleReferencePath, parseOsisReference, resolveEditorialHref } from './editorialLinks'

describe('parseOsisReference', () => {
  it('reads a chapter, a verse and a range within a chapter', () => {
    expect(parseOsisReference('Gen.1')).toEqual({ book: 1, chapter: 1 })
    expect(parseOsisReference('John.3.16')).toEqual({ book: 43, chapter: 3, verse: 16 })
    expect(parseOsisReference('Luke.6.20-Luke.6.49')).toEqual({
      book: 42,
      chapter: 6,
      verse: 20,
      endVerse: 49,
    })
  })

  it('stops a range leaving its chapter at its first verse', () => {
    expect(parseOsisReference('Matt.5.1-Matt.7.29')).toEqual({ book: 40, chapter: 5, verse: 1 })
  })
})

describe('buildBibleReferencePath', () => {
  it('opens a reference in the reference Bible of the language', () => {
    expect(buildBibleReferencePath('fr', { book: 43, chapter: 3, verse: 16 })).toBe(
      '/bible/lsg/john/3/16'
    )
    expect(buildBibleReferencePath('en', { book: 19, chapter: 23 })).toBe('/bible/kjv/ps/23')
  })

  it('has no page for a book the reference Bible does not carry', () => {
    expect(buildBibleReferencePath('fr', { book: 67, chapter: 1 })).toBeUndefined()
  })
})

describe('resolveEditorialHref', () => {
  it('resolves the Strong and Bible schemes to site pages', () => {
    expect(resolveEditorialHref('strong://H430', { language: 'fr' })).toBe('/strong/fr/h0430')
    expect(resolveEditorialHref('bible://Gen.1.1', { language: 'en' })).toBe('/bible/kjv/gen/1/1')
  })

  it('leaves any other target, and a badly encoded one, unresolved', () => {
    expect(resolveEditorialHref('https://example.org', { language: 'fr' })).toBeUndefined()
    expect(resolveEditorialHref('bible://Gen%.1', { language: 'fr' })).toBeUndefined()
  })
})
