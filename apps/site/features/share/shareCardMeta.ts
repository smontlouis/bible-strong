import {
  SHARE_CARD_META,
  SHARE_CARD_SIZE,
  shareCardUrl,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'

/**
 * The share image of a page, as its head announces it. The page writes what the image shows
 * in a meta element of its own; the share card service reads it back from the rendered page
 * and draws it, so an image can only ever show what a page of the site shows. A page that
 * says nothing gets the default card.
 */
export const shareCardMeta = (path: string, content?: ShareCardContent) => {
  const image = shareCardUrl(path)
  return [
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(SHARE_CARD_SIZE.width) },
    { property: 'og:image:height', content: String(SHARE_CARD_SIZE.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
    ...(content ? [{ name: SHARE_CARD_META, content: JSON.stringify(content) }] : []),
  ]
}
