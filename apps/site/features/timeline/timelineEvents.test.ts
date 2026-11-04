import { describe, expect, it } from 'vitest'
import { TIMELINE_MESSAGES } from './messages'
import { timelineImageUrl, timelineParagraphs, timelineThumbnailUrl } from './timelineEvents'
import {
  fitTimelinePassage,
  listTimelinePassages,
  parseTimelineScripture,
  timelineExcerptVerses,
  timelinePassageLabel,
} from './timelineScriptures'

describe('Timeline article text', () => {
  it('ends a paragraph on a blank line, whatever spaces surround it', () => {
    expect(timelineParagraphs('Un.\n \n\n Deux.\n\nTrois.\n \n\n \n\n Quatre. ')).toEqual([
      'Un.',
      'Deux.',
      'Trois.',
      'Quatre.',
    ])
  })

  it('keeps a single line break inside its paragraph', () => {
    expect(timelineParagraphs(' Daniel 7\nDans la vision de Daniel.\n \n\n Suite.')).toEqual([
      'Daniel 7\nDans la vision de Daniel.',
      'Suite.',
    ])
  })

  it('has no paragraph for an empty article', () => {
    expect(timelineParagraphs('')).toEqual([])
    expect(timelineParagraphs(' \n \n\n ')).toEqual([])
  })
})

describe('Timeline images', () => {
  it('addresses an image by its encoded file name', () => {
    expect(timelineImageUrl('Adam_4-4-2013 10-22-05 AM.jpg')).toBe(
      'https://media.bible-strong.app/timeline-images/w1200/Adam_4-4-2013%2010-22-05%20AM.jpg.webp'
    )
    expect(timelineImageUrl('map.PNG')).toMatch(/\/map\.PNG\.webp$/u)
    expect(timelineThumbnailUrl('Adam 1.jpg')).toBe(
      'https://media.bible-strong.app/timeline-images/w480/Adam%201.jpg.webp'
    )
  })

  it('has no address for anything but a plain image file name', () => {
    for (const file of [
      '',
      'notes.txt',
      '../secret.jpg',
      'https://example.com/a.jpg',
      'a\\b.gif',
    ]) {
      expect(timelineImageUrl(file)).toBeUndefined()
    }
  })
})

describe('Timeline passages', () => {
  it('reads a verse and a span of verses', () => {
    expect(parseTimelineScripture('1|2:7')).toEqual({ book: 1, chapter: 2, verse: 7 })
    expect(parseTimelineScripture('4|13:1-33')).toEqual({
      book: 4,
      chapter: 13,
      verse: 1,
      endVerse: 33,
    })
    expect(parseTimelineScripture('42|3:26-26')).toEqual({ book: 42, chapter: 3, verse: 26 })
  })

  it('leaves any other shape unread', () => {
    for (const value of ['', '1|43|2:1', 'Gen.2.7', '0|2:7', '1|0:7', '1|2:0', '99|1:1', '1|2']) {
      expect(parseTimelineScripture(value)).toBeUndefined()
    }
  })

  it('lists each passage once, in the order it is cited', () => {
    expect(listTimelinePassages(['1|11:26', '1|25:8', '3|43|1:1', '1|11:26', '1|25:8'])).toEqual([
      { book: 1, chapter: 11, verse: 26 },
      { book: 1, chapter: 25, verse: 8 },
    ])
  })

  it('fits a passage to the verse numbering of the Bible it opens in', () => {
    const span = { book: 1, chapter: 31, verse: 1, endVerse: 55 }
    expect(fitTimelinePassage(span, 55)).toEqual(span)
    expect(fitTimelinePassage(span, 54)).toEqual({ ...span, endVerse: 54 })
    expect(fitTimelinePassage({ book: 27, chapter: 5, verse: 30, endVerse: 31 }, 30)).toEqual({
      book: 27,
      chapter: 5,
      verse: 30,
    })
    // Daniel 5:31 is the first verse of chapter 6 in French Bibles.
    expect(fitTimelinePassage({ book: 27, chapter: 5, verse: 31 }, 30)).toBeUndefined()
    expect(fitTimelinePassage({ book: 1, chapter: 2, verse: 7 }, undefined)).toBeUndefined()
  })

  it('labels a passage as Bible pages do', () => {
    expect(timelinePassageLabel({ book: 1, chapter: 2, verse: 7 }, 'fr')).toBe('Genèse 2:7')
    expect(timelinePassageLabel({ book: 1, chapter: 7, verse: 1, endVerse: 6 }, 'en')).toBe(
      'Genesis 7:1-6'
    )
  })

  it('quotes the first verses of a passage', () => {
    expect(timelineExcerptVerses({ book: 1, chapter: 2, verse: 7 })).toEqual([7])
    expect(timelineExcerptVerses({ book: 1, chapter: 5, verse: 28, endVerse: 29 })).toEqual([
      28, 29,
    ])
    expect(timelineExcerptVerses({ book: 4, chapter: 13, verse: 1, endVerse: 33 })).toEqual([
      1, 2, 3,
    ])
  })
})

describe('Timeline metadata', () => {
  it('keeps the description of the timeline within a search result snippet', () => {
    for (const language of ['fr', 'en'] as const) {
      const description = TIMELINE_MESSAGES[language].indexHeadDescription
        .replace('{events}', '9 999')
        .replace('{periods}', '13')
      expect(description.length).toBeLessThanOrEqual(155)
    }
  })
})
