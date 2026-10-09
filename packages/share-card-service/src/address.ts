import { SHARE_CARD_DESIGN } from './content'

/** `/v1/<path of a page>`: the page whose image is asked for, or nothing for another address. */
export const pagePathOf = (url: URL): string | undefined => {
  const prefix = `/${SHARE_CARD_DESIGN}`
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return undefined
  return `${url.pathname.slice(prefix.length) || '/'}${url.search}`
}

/** Where the image of a page is kept. A new design keeps its images apart from the old ones. */
export const storageKeyOf = (pagePath: string): string =>
  `share-cards/${SHARE_CARD_DESIGN}${pagePath === '/' ? '/index' : pagePath}`
