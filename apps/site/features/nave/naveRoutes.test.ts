import { describe, expect, it } from 'vitest'
import {
  buildNaveIndexPath,
  buildNaveLetterPath,
  buildNavePath,
  buildWebAppNaveUrl,
  isNaveLetter,
  NAVE_LIST_PAGE_SIZE,
  naveListPage,
  naveListPageCount,
  naveListPageOf,
  parseNavePageNumber,
  parseNaveTopic,
} from './naveRoutes'

describe('Nave public routes', () => {
  it('keeps a topic name as published, apart from surrounding whitespace', () => {
    expect(parseNaveTopic('aaron')).toBe('aaron')
    expect(parseNaveTopic(' abstinence, total ')).toBe('abstinence, total')
    expect(parseNaveTopic('Dog (Sodomite?)')).toBe('Dog (Sodomite?)')
  })

  it('rejects an empty name', () => {
    expect(parseNaveTopic(undefined)).toBeUndefined()
    expect(parseNaveTopic('')).toBeUndefined()
    expect(parseNaveTopic('   ')).toBeUndefined()
  })

  it('percent-encodes the whole name, as the study workspace does', () => {
    expect(buildNavePath('fr', 'aaron')).toBe('/nave/fr/aaron')
    expect(buildNavePath('en', 'abstinence, total')).toBe('/nave/en/abstinence%2C%20total')
    expect(buildNavePath('en', 'dog (sodomite?)')).toBe('/nave/en/dog%20(sodomite%3F)')
    expect(buildNavePath('en', 'god continued...')).toBe('/nave/en/god%20continued...')
    expect(buildNavePath('fr', 'bonté')).toBe('/nave/fr/bont%C3%A9')
    expect(buildNavePath('fr', ' sin-2 ')).toBe('/nave/fr/sin-2')
    expect(() => buildNavePath('fr', ' ')).toThrow('NAVE_ROUTE_INVALID')
  })

  it('opens the same path in the study workspace', () => {
    expect(buildWebAppNaveUrl('en', 'holy spirit')).toBe(
      'https://web.bible-strong.app/nave/en/holy%20spirit'
    )
  })

  it('builds the entry and letter paths, the first page without a number', () => {
    expect(buildNaveIndexPath('fr')).toBe('/nave/fr')
    expect(buildNaveLetterPath('en', 's')).toBe('/nave/en/index/s')
    expect(buildNaveLetterPath('en', 's', 1)).toBe('/nave/en/index/s')
    expect(buildNaveLetterPath('en', 's', 2)).toBe('/nave/en/index/s/2')
  })

  it('accepts plain lower-case letters only', () => {
    expect(isNaveLetter('a')).toBe(true)
    expect(isNaveLetter('z')).toBe(true)
    for (const value of [undefined, '', 'A', 'é', 'ab', '1'])
      expect(isNaveLetter(value)).toBe(false)
  })

  it('reads a page number as written in a path', () => {
    expect(parseNavePageNumber('2')).toBe(2)
    expect(parseNavePageNumber('12')).toBe(12)
    for (const value of [undefined, '', '0', '02', '-1', '1.5', 'two', '12345']) {
      expect(parseNavePageNumber(value)).toBeUndefined()
    }
  })
})

describe('Nave topic lists', () => {
  const topics = (count: number) => Array.from({ length: count }, (_, position) => position)

  it('keeps a letter on one page up to the page size', () => {
    expect(naveListPageCount(0)).toBe(1)
    expect(naveListPageCount(NAVE_LIST_PAGE_SIZE)).toBe(1)
    expect(naveListPage(topics(NAVE_LIST_PAGE_SIZE), 1)).toHaveLength(NAVE_LIST_PAGE_SIZE)
  })

  it('shares the topics of a larger letter evenly between its pages', () => {
    expect(naveListPageCount(320)).toBe(2)
    expect(naveListPage(topics(320), 1)).toHaveLength(160)
    expect(naveListPage(topics(320), 2)).toEqual(topics(320).slice(160))
    expect(naveListPageCount(601)).toBe(3)
    expect(naveListPage(topics(601), 3)).toEqual(topics(601).slice(402))
    expect(naveListPage(topics(320), 3)).toEqual([])
  })

  it('finds the page a topic is listed on', () => {
    expect(naveListPageOf(120, 119)).toBe(1)
    expect(naveListPageOf(320, 159)).toBe(1)
    expect(naveListPageOf(320, 160)).toBe(2)
    expect(naveListPageOf(601, 600)).toBe(3)
    expect(naveListPageOf(0, 0)).toBe(1)
  })
})
