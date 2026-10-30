import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import type { SyntheticEvent } from 'react'

import { getChapterEntityAvatar } from '../chapterEntityAvatar'

const PLACEHOLDER = '/assets/place-1.webp'

jest.mock('~features/lexique/strongEntityAvatars', () => ({
  getStrongEntityPlaceholderSource: () => ({ uri: '/assets/place-1.webp' }),
}))

const entity = {
  uniqueName: 'Bethlehem@Gen.35.16-Jhn',
  category: 'place',
  type: 'city',
} as StrongLexiconChapterEntity

// Like a browser's image: the attribute keeps what was set and `src` reads it back as absolute.
const createImage = (initial: string) => {
  let attribute = initial
  const image = {
    loads: 0,
    getAttribute: () => attribute,
    get src() {
      return new URL(attribute, 'https://web.bible-strong.app/bible/lsg/john/3').href
    },
    set src(value: string) {
      attribute = value
      image.loads += 1
    },
  }
  return image
}

const failLoading = (
  onError: (event: SyntheticEvent<HTMLImageElement>) => void,
  image: ReturnType<typeof createImage>
) => onError({ currentTarget: image } as unknown as SyntheticEvent<HTMLImageElement>)

describe('getChapterEntityAvatar', () => {
  it('falls back to the placeholder when the portrait cannot be loaded', () => {
    const portrait = 'https://media.bible-strong.app/entity-images/bethlehem/w256.webp'
    const { onError } = getChapterEntityAvatar(entity, { [entity.uniqueName]: portrait })
    const image = createImage(portrait)

    failLoading(onError, image)

    expect(image.getAttribute()).toBe(PLACEHOLDER)
    expect(image.loads).toBe(1)
  })

  it('stops when the placeholder itself cannot be loaded', () => {
    const { src, onError } = getChapterEntityAvatar(entity, {})
    const image = createImage(src)

    failLoading(onError, image)
    failLoading(onError, image)

    expect(image.loads).toBe(0)
  })

  it('tries the placeholder only once after a failing portrait', () => {
    const portrait = 'https://media.bible-strong.app/entity-images/bethlehem/w256.webp'
    const { onError } = getChapterEntityAvatar(entity, { [entity.uniqueName]: portrait })
    const image = createImage(portrait)

    failLoading(onError, image)
    failLoading(onError, image)
    failLoading(onError, image)

    expect(image.loads).toBe(1)
  })
})
