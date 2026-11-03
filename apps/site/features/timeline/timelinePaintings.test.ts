import { describe, expect, it } from 'vitest'
import {
  parseTimelinePaintings,
  timelineEventPictures,
  timelineEventThumbnail,
  timelinePaintingUrl,
} from './timelinePaintings'

const images = [
  { caption: 'Later art', file: 'art.jpg' },
  { caption: 'His tomb', file: 'tomb.jpg' },
]

describe('Timeline paintings', () => {
  it('addresses a size of the painting of an event', () => {
    expect(timelinePaintingUrl('isaac', 'abcdef', 'w256')).toBe(
      'https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w256.webp'
    )
  })

  it('keeps the well-formed entries of the catalog', () => {
    expect(
      parseTimelinePaintings({
        version: 1,
        events: { isaac: { hash: 'abcdef', documents: ['tomb.jpg'] }, broken: { hash: '?' } },
      })
    ).toEqual({ isaac: { hash: 'abcdef', documents: ['tomb.jpg'] } })
    expect(parseTimelinePaintings({ version: 2, events: {} })).toBeUndefined()
  })

  it('shows the painting, then only the documents of the catalog', () => {
    expect(
      timelineEventPictures('isaac', images, { hash: 'abcdef', documents: ['tomb.jpg'] })
    ).toEqual([
      {
        src: 'https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w1254.webp',
        srcSet:
          'https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w768.webp 768w, https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w1254.webp 1254w',
        caption: '',
      },
      {
        src: 'https://media.bible-strong.app/timeline-images/w1200/tomb.jpg.webp',
        caption: 'His tomb',
      },
    ])
  })

  it('keeps the pictures of the publication without a painting', () => {
    expect(timelineEventPictures('isaac', images, undefined)).toHaveLength(2)
    expect(timelineEventThumbnail({}, { slug: 'isaac', image: 'art.jpg' }, 'w256')).toBe(
      'https://media.bible-strong.app/timeline-images/w480/art.jpg.webp'
    )
    expect(timelineEventThumbnail({}, { slug: 'isaac' }, 'w256')).toBeUndefined()
  })

  it('takes the thumbnail of a painting at the size asked', () => {
    expect(
      timelineEventThumbnail(
        { isaac: { hash: 'abcdef', documents: [] } },
        { slug: 'isaac', image: 'art.jpg' },
        'w768'
      )
    ).toBe('https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w768.webp')
  })
})
