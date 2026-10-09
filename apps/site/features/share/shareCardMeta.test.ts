import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSignedShareCard } from './shareCardAddress'
import { shareCardMeta } from './shareCardMeta'
import { afterReference, firstSpelling, shareCardPicture } from './shareCardText'

const imageOf = (meta: ReturnType<typeof shareCardMeta>) =>
  meta.find(entry => 'property' in entry && entry.property === 'og:image')?.content ?? ''

describe('Share image of a page', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is named by an address that carries what it shows', () => {
    vi.stubEnv('SHARE_CARD_SECRET', 'secret')
    const content = { kind: 'text', kicker: 'Jean 3:16', chip: 'LSG', text: 'Car Dieu a tant aimé.' } as const
    const meta = shareCardMeta(content)
    const image = imageOf(meta)
    expect(image.startsWith('https://cards.bible-strong.app/v1/')).toBe(true)
    expect(readSignedShareCard(image.slice('https://cards.bible-strong.app/v1/'.length), 'secret')).toEqual(content)
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(meta).toContainEqual({ name: 'twitter:image', content: image })
  })

  it('is the default card when the page says nothing', () => {
    vi.stubEnv('SHARE_CARD_SECRET', 'secret')
    expect(imageOf(shareCardMeta())).toBe('https://cards.bible-strong.app/v1')
  })

  it('is the default card when the site was given no secret', () => {
    vi.stubEnv('SHARE_CARD_SECRET', '')
    expect(imageOf(shareCardMeta({ kind: 'text', kicker: 'Jean 3:16', text: 'Car Dieu.' }))).toBe(
      'https://cards.bible-strong.app/v1'
    )
  })
})

describe('Share card helpers', () => {
  it('keeps one spelling of a transliteration written twice', () => {
    expect(firstSpelling('shâlôm shâlôm')).toBe('shâlôm')
    expect(firstSpelling('bêyth ʼêl')).toBe('bêyth ʼêl')
  })

  it('drops the opening that names the work and the reference', () => {
    expect(afterReference('Commentaire concis, Jean 3 : Nicodème vint.', 'Jean 3')).toBe('Nicodème vint.')
    expect(afterReference('Nicodème vint.', 'Jean 3')).toBe('Nicodème vint.')
  })

  it('takes the original of a picture, which the renderer can read', () => {
    expect(shareCardPicture('https://media.bible-strong.app/timeline-images/w1200/Adam%201.jpg.webp')).toBe(
      'https://media.bible-strong.app/timeline-images/original/Adam%201.jpg'
    )
    expect(shareCardPicture('https://media.bible-strong.app/timeline-images/w1200/anim.gif.webp')).toBeUndefined()
    expect(shareCardPicture(undefined)).toBeUndefined()
  })
})
