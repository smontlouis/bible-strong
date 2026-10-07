import { describe, expect, it } from 'vitest'
import {
  naveReferenceLinks,
  naveVerseRuns,
  parseNaveVerseTarget,
  resolveNaveHref,
} from './naveReferences'

describe('Nave verse targets', () => {
  it('reads a chapter, a verse and a list of verses', () => {
    expect(parseNaveVerseTarget('2-28')).toEqual({ book: 2, chapter: 28, verses: [] })
    expect(parseNaveVerseTarget('19-106-16')).toEqual({ book: 19, chapter: 106, verses: [16] })
    expect(parseNaveVerseTarget('2-6-13,26,27')).toEqual({
      book: 2,
      chapter: 6,
      verses: [13, 26, 27],
    })
  })

  it('rejects anything else, and books the site does not read', () => {
    for (const target of [
      '',
      '2',
      '2-',
      'a-1-1',
      '2-6-13,',
      '2-6-13;14',
      '2-0-1',
      '2-6-0',
      '0-1-1',
    ]) {
      expect(parseNaveVerseTarget(target)).toBeUndefined()
    }
    expect(parseNaveVerseTarget('99-1-1')).toBeUndefined()
  })

  it('groups consecutive verses into runs, in the order they are cited', () => {
    expect(naveVerseRuns([])).toEqual([])
    expect(naveVerseRuns([7])).toEqual([{ start: 7, end: 7 }])
    expect(naveVerseRuns([3, 4, 5, 50, 51, 53])).toEqual([
      { start: 3, end: 5 },
      { start: 50, end: 51 },
      { start: 53, end: 53 },
    ])
  })
})

describe('Nave reference links', () => {
  const labels = (verses: number[], language: 'fr' | 'en', book = 19, chapter = 34) =>
    naveReferenceLinks({ book, chapter, verses }, language)
      .map(link => link.label)
      .join(',')

  it('names the book in the language of the page', () => {
    expect(labels([1, 2, 3, 4, 5, 6, 7, 8, 22], 'fr')).toBe('Psaumes 34:1-8,22')
    expect(labels([1, 2, 3, 4, 5, 6, 7, 8, 22], 'en')).toBe('Psalms 34:1-8,22')
    expect(labels([], 'fr', 2, 28)).toBe('Exode 28')
  })

  it('links each run of verses to its own passage', () => {
    expect(naveReferenceLinks({ book: 13, chapter: 6, verses: [3, 4, 5, 50, 51] }, 'fr')).toEqual([
      { label: '1 Chroniques 6:3-5', target: '13-6-3,4,5' },
      { label: '50-51', target: '13-6-50,51' },
    ])
    expect(naveReferenceLinks({ book: 3, chapter: 8, verses: [] }, 'en')).toEqual([
      { label: 'Leviticus 8', target: '3-8' },
    ])
  })
})

describe('Nave link resolution', () => {
  const topics = new Set(['priest', 'abstinence, total'])
  const resolve = (href: string, language: 'fr' | 'en' = 'fr') =>
    resolveNaveHref(href, { language, hasTopic: name => topics.has(name) })

  it('opens a verse link in the Bible of the page language', () => {
    expect(resolve('v=2-6-23')).toBe('/bible/lsg/exod/6/23')
    expect(resolve('v=2-6-16,17,18,19,20')).toBe('/bible/lsg/exod/6/16-20')
    expect(resolve('v=13-24')).toBe('/bible/lsg/1chr/24')
    expect(resolve('v=19-106-16', 'en')).toBe('/bible/kjv/ps/106/16')
  })

  it('opens a list of separate verses at its first run', () => {
    expect(resolve('v=2-6-13,26,27')).toBe('/bible/lsg/exod/6/13')
  })

  it('opens a cross-reference on the topic page of the same language', () => {
    expect(resolve('w=priest')).toBe('/nave/fr/priest')
    expect(resolve('w=abstinence, total', 'en')).toBe('/nave/en/abstinence%2C%20total')
  })

  it('leaves unresolved a topic the publication does not hold and any other target', () => {
    expect(resolve('w=hair')).toBeUndefined()
    expect(resolve('w=')).toBeUndefined()
    expect(resolve('v=99-1-1')).toBeUndefined()
    expect(resolve('v=nope')).toBeUndefined()
    expect(resolve('view.cgi?n=1783')).toBeUndefined()
    expect(resolve('https://example.com/')).toBeUndefined()
    expect(resolve('javascript:alert(1)')).toBeUndefined()
  })
})
