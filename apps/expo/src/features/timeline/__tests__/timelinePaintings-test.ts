import {
  getTimelineEventPictures,
  getTimelinePaintingUri,
  parseTimelinePaintings,
} from '../timelinePaintings'

const images = [
  { caption: 'Later art', file: 'art.jpg' },
  { caption: 'His tomb', file: 'tomb.jpg' },
]

describe('getTimelinePaintingUri', () => {
  it('addresses a size of the painting of an event', () => {
    expect(getTimelinePaintingUri('isaac', '0123456789ab', 'w256')).toBe(
      'https://media.bible-strong.app/timeline-paintings/isaac/0123456789ab/w256.webp'
    )
  })
})

describe('parseTimelinePaintings', () => {
  it('keeps the well-formed entries', () => {
    expect(
      parseTimelinePaintings({
        version: 1,
        events: {
          isaac: { hash: '0123456789ab', documents: ['tomb.jpg', 3] },
          jacob: { hash: 'abcdef' },
          broken: { hash: 'not a hash' },
        },
      })
    ).toEqual({
      isaac: { hash: '0123456789ab', documents: ['tomb.jpg'] },
      jacob: { hash: 'abcdef', documents: [] },
    })
  })

  it('refuses another version of the catalog', () => {
    expect(parseTimelinePaintings({ version: 2, events: {} })).toBeUndefined()
    expect(parseTimelinePaintings('nothing')).toBeUndefined()
  })
})

describe('getTimelineEventPictures', () => {
  it('shows the painting, then only the documents of the catalog', () => {
    expect(
      getTimelineEventPictures('isaac', images, { hash: 'abcdef', documents: ['tomb.jpg'] })
    ).toEqual([
      {
        uri: 'https://media.bible-strong.app/timeline-paintings/isaac/abcdef/w1254.webp',
        caption: '',
      },
      {
        uri: 'https://media.bible-strong.app/timeline-images/w1200/tomb.jpg.webp',
        caption: 'His tomb',
      },
    ])
  })

  it('keeps the pictures of the publication without a painting', () => {
    expect(getTimelineEventPictures('isaac', images, undefined).map(p => p.caption)).toEqual([
      'Later art',
      'His tomb',
    ])
  })
})
