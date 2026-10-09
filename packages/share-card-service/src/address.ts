import { SHARE_CARD_DESIGN } from './content'

// A signed description: two runs of the URL-safe alphabet around a dot.
const SIGNED = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u

/**
 * What an address asks for: the signed description after `/v1/`, an empty string for the
 * default card at `/v1`, or nothing for any other address.
 */
export const signedDescriptionOf = (url: URL): string | undefined => {
  const prefix = `/${SHARE_CARD_DESIGN}`
  if (url.pathname === prefix || url.pathname === `${prefix}/`) return ''
  if (!url.pathname.startsWith(`${prefix}/`)) return undefined
  const signed = url.pathname.slice(prefix.length + 1)
  return SIGNED.test(signed) ? signed : undefined
}

/**
 * Where an image is kept. The key is a digest of its description, so the same card is drawn
 * once whatever page shows it, and a new design keeps its images apart from the old ones.
 */
export const storageKeyOf = async (signed: string): Promise<string> => {
  if (!signed) return `share-cards/${SHARE_CARD_DESIGN}/default`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signed))
  const name = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `share-cards/${SHARE_CARD_DESIGN}/${name}`
}
