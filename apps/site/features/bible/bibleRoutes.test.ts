import { ONLINE_BIBLE_VERSION_IDS } from '@bible-strong/resource-catalog/ordinary-bibles'
import { describe, expect, it } from 'vitest'
import { bibleBookName, bibleBookSlug, findBibleBook } from './bibleBooks'
import {
  bibleVersionAids,
  buildBiblePath,
  buildWebAppBibleUrl,
  closestBiblePresentation,
  parseBibleRoute,
  supportedBiblePresentations,
} from './bibleRoutes'
import { BIBLE_VERSIONS, bibleVersionCoversBook, findBibleVersion } from './bibleVersions'

describe('Bible versions', () => {
  it('lists exactly the Bibles of the shared catalog', () => {
    expect(BIBLE_VERSIONS.map(version => version.id).sort()).toEqual(
      [...ONLINE_BIBLE_VERSION_IDS].sort()
    )
  })

  it('resolves a version from its path slug', () => {
    expect(findBibleVersion('lsg')?.id).toBe('LSG')
    expect(findBibleVersion('lxx-fr')?.id).toBe('LXX_FR')
    expect(findBibleVersion('nope')).toBeUndefined()
  })

  it('links a book only to versions expected to carry it', () => {
    const covers = (id: string, book: number) =>
      bibleVersionCoversBook(BIBLE_VERSIONS.find(version => version.id === id)!, book)
    expect(covers('LSG', 1)).toBe(true)
    expect(covers('SBLGNT', 1)).toBe(false)
    expect(covers('SBLGNT', 40)).toBe(true)
    expect(covers('BHS', 40)).toBe(false)
    expect(covers('BCC1923', 67)).toBe(false)
  })
})

describe('Bible books', () => {
  it('uses lowercase OSIS identities, deuterocanonical books included', () => {
    expect(bibleBookSlug(1)).toBe('gen')
    expect(bibleBookSlug(43)).toBe('john')
    expect(findBibleBook('1cor')).toBe(46)
    expect(findBibleBook('tob')).toBe(67)
    expect(findBibleBook('genese')).toBeUndefined()
    expect(bibleBookName(67, 'fr')).toBe('Tobie')
  })
})

describe('Bible public routes', () => {
  it('parses a chapter, a verse and a verse range', () => {
    expect(parseBibleRoute('lsg/gen/1')).toMatchObject({
      version: { id: 'LSG' },
      presentation: 'text',
      book: 1,
      chapter: 1,
    })
    expect(parseBibleRoute('kjv/john/3/16')?.passage).toEqual({ startVerse: 16 })
    expect(parseBibleRoute('kjv/john/3/16-18')?.passage).toEqual({ startVerse: 16, endVerse: 18 })
    expect(parseBibleRoute('kjv/john/3/16-16')?.passage).toEqual({ startVerse: 16 })
  })

  it('offers each reading mode only where its data exists', () => {
    expect(supportedBiblePresentations('LSG')).toEqual(['text', 'strong', 'reverse-interlinear'])
    expect(supportedBiblePresentations('S21')).toEqual(['text'])
    expect(supportedBiblePresentations('BHG')).toEqual(['text', 'interlinear'])
    // Only the original-language Bible is labelled as the interlinear.
    expect(bibleVersionAids('LSG')).toEqual(['strong'])
    expect(bibleVersionAids('BHG')).toEqual(['interlinear'])
    expect(bibleVersionAids('S21')).toEqual([])
    expect(parseBibleRoute('lsg/strong/gen/1')?.presentation).toBe('strong')
    expect(parseBibleRoute('kjv/reverse-interlinear/john/3/16')?.presentation).toBe(
      'reverse-interlinear'
    )
    expect(parseBibleRoute('bhg/interlinear/fr/gen/1')?.presentation).toBe('interlinear')
    for (const path of ['s21/strong/gen/1', 'lsg/interlinear/fr/gen/1', 'bhg/strong/gen/1']) {
      expect(parseBibleRoute(path), path).toBeUndefined()
    }
  })

  it('names the gloss language of an interlinear reading in its path', () => {
    expect(parseBibleRoute('bhg/interlinear/en/john/3/16')).toMatchObject({
      presentation: 'interlinear',
      gloss: 'en',
      book: 43,
      chapter: 3,
      passage: { startVerse: 16 },
    })
    expect(parseBibleRoute('bhg/interlinear/fr/gen/1')?.gloss).toBe('fr')
    // The language is part of the identity of the page: it cannot be left out.
    expect(parseBibleRoute('bhg/interlinear/gen/1')).toBeUndefined()
    expect(parseBibleRoute('bhg/interlinear/de/gen/1')).toBeUndefined()
    expect(parseBibleRoute('bhg/gen/1')?.gloss).toBeUndefined()

    const location = { versionId: 'BHG', presentation: 'interlinear' as const, book: 1, chapter: 1 }
    expect(buildBiblePath({ ...location, gloss: 'en' })).toBe('/bible/bhg/interlinear/en/gen/1')
    expect(buildBiblePath(location)).toBe('/bible/bhg/interlinear/fr/gen/1')
    expect(buildBiblePath({ versionId: 'LSG', book: 1, chapter: 1, gloss: 'en' })).toBe(
      '/bible/lsg/gen/1'
    )
  })

  it('keeps the closest reading mode across versions', () => {
    expect(closestBiblePresentation('KJV', 'reverse-interlinear')).toBe('reverse-interlinear')
    expect(closestBiblePresentation('BHG', 'reverse-interlinear')).toBe('interlinear')
    expect(closestBiblePresentation('LSG', 'interlinear')).toBe('reverse-interlinear')
    expect(closestBiblePresentation('S21', 'strong')).toBe('text')
    expect(closestBiblePresentation('BHG', 'strong')).toBe('text')
  })

  it('rejects malformed paths', () => {
    for (const path of [
      '',
      'lsg',
      'lsg/gen',
      'nope/gen/1',
      'lsg/genese/1',
      'lsg/gen/0',
      'lsg/gen/x',
      'lsg/gen/1/18-16',
      'lsg/gen/1/2/3',
      'lsg/reverse-interlinear',
    ]) {
      expect(parseBibleRoute(path), path).toBeUndefined()
    }
  })

  it('builds the canonical path shared with the study workspace', () => {
    expect(buildBiblePath({ versionId: 'LSG', book: 1, chapter: 1 })).toBe('/bible/lsg/gen/1')
    expect(
      buildBiblePath({ versionId: 'LXX_FR', book: 19, chapter: 23, passage: { startVerse: 1 } })
    ).toBe('/bible/lxx-fr/ps/23/1')
    expect(
      buildBiblePath({
        versionId: 'KJV',
        presentation: 'strong',
        book: 43,
        chapter: 3,
        passage: { startVerse: 16, endVerse: 18 },
      })
    ).toBe('/bible/kjv/strong/john/3/16-18')
    expect(buildWebAppBibleUrl({ versionId: 'LSG', book: 1, chapter: 1 })).toBe(
      'https://web.bible-strong.app/bible/lsg/gen/1'
    )
    expect(
      buildWebAppBibleUrl({ versionId: 'BHG', presentation: 'interlinear', book: 1, chapter: 1, gloss: 'en' })
    ).toBe('https://web.bible-strong.app/bible/bhg/interlinear/en/gen/1')
    expect(() => buildBiblePath({ versionId: 'S21', presentation: 'strong', book: 1, chapter: 1 })).toThrow(
      'BIBLE_ROUTE_INVALID'
    )
  })
})
