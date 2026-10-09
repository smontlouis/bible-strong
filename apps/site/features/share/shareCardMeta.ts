import {
  SHARE_CARD_SIZE,
  shareCardUrl,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import { shareCardSecret, signShareCard } from './shareCardAddress'

/**
 * The share image of a page, as its head announces it. The address of the image carries what
 * it shows, signed by the site, so the image is drawn from its address alone. A page that
 * says nothing, or a site that was given no secret, names the default card.
 */
export const shareCardMeta = (content?: ShareCardContent) => {
  const secret = shareCardSecret()
  const image = shareCardUrl(content && secret ? signShareCard(content, secret) : undefined)
  return [
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(SHARE_CARD_SIZE.width) },
    { property: 'og:image:height', content: String(SHARE_CARD_SIZE.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
  ]
}
