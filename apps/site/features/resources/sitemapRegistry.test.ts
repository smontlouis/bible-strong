import { describe, expect, it } from 'vitest'
import { BIBLE_VERSE_SITEMAPS } from '../bible/bibleVerseSitemap'
import { ANNOUNCE_BIBLE_VERSE_SITEMAPS, listAnnouncedSitemaps, SITEMAPS } from './sitemapRegistry'

const VERSE_SITEMAPS = Object.keys(BIBLE_VERSE_SITEMAPS)

describe('sitemap registry', () => {
  it('serves the verse sitemaps next to the others', () => {
    expect(VERSE_SITEMAPS).toContain('bible-lsg-verses.xml')
    for (const name of VERSE_SITEMAPS) expect(SITEMAPS[name]).toBeTypeOf('function')
    // A verse sitemap never takes the name of the chapters of a version.
    expect(SITEMAPS['bible-lsg.xml']).not.toBe(SITEMAPS['bible-lsg-verses.xml'])
  })

  it('keeps the verse sitemaps out of the index until they are announced', () => {
    const announced = listAnnouncedSitemaps(false)

    expect(announced).toContain('bible-lsg.xml')
    expect(announced).toContain('pages.xml')
    expect(announced.filter(name => VERSE_SITEMAPS.includes(name))).toEqual([])
    expect(announced).toHaveLength(Object.keys(SITEMAPS).length - VERSE_SITEMAPS.length)
  })

  it('lists every sitemap once the verse sitemaps are announced', () => {
    expect(listAnnouncedSitemaps(true)).toEqual(Object.keys(SITEMAPS))
  })

  it('follows the one switch when nothing else is asked', () => {
    expect(listAnnouncedSitemaps()).toEqual(listAnnouncedSitemaps(ANNOUNCE_BIBLE_VERSE_SITEMAPS))
  })
})
