import { describe, expect, it } from 'vitest'
import type { ShareCardContent } from './ShareCard'
import { readShareCardMeta, SHARE_CARD_META, shareCardMeta } from './shareCardMeta'
import { afterReference, firstSpelling, shareCardPicture } from './shareCardText'

// What React writes for an attribute value.
const attribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
const page = (meta: { name?: string; property?: string; content: string }[]) =>
  `<html><head>${meta
    .map(({ name, property, content }) =>
      name
        ? `<meta name="${name}" content="${attribute(content)}"/>`
        : `<meta property="${property}" content="${attribute(content)}"/>`
    )
    .join('')}</head></html>`

describe('Share card of a page', () => {
  it('is announced under the path of the page', () => {
    const meta = shareCardMeta('/bible/lsg/john/3/16')
    expect(meta).toContainEqual({
      property: 'og:image',
      content: 'https://bible-strong.app/share-card/bible/lsg/john/3/16',
    })
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(meta.some(entry => 'name' in entry && entry.name === SHARE_CARD_META)).toBe(false)
  })

  it('names the default card for the home page', () => {
    expect(shareCardMeta('/')).toContainEqual({
      property: 'og:image',
      content: 'https://bible-strong.app/share-card',
    })
  })

  it('is read back from the rendered page as the page wrote it', () => {
    const content: ShareCardContent = {
      kind: 'text',
      kicker: 'Jean 3:16',
      chip: 'LSG',
      text: 'Il dit : "C’est <ici> & maintenant", l\'heure.',
    }
    expect(readShareCardMeta(page(shareCardMeta('/bible/lsg/john/3/16', content)))).toEqual(content)
  })

  it('is the default card when the page says nothing, or nothing readable', () => {
    expect(readShareCardMeta(page(shareCardMeta('/privacy-policy')))).toBeUndefined()
    expect(readShareCardMeta(page([{ name: SHARE_CARD_META, content: '{"kind":"poster"}' }]))).toBeUndefined()
    expect(readShareCardMeta(page([{ name: SHARE_CARD_META, content: 'not json' }]))).toBeUndefined()
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
