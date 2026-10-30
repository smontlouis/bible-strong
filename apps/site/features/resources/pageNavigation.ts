import { defaultParseSearch } from '@tanstack/react-router'

// How the reader moves from one page of the site to another: inside the document, with the
// router (ADR-0093). What leaves the site, or stays on the page, is the browser's to follow.

export type SiteAddress = { to: string; search: Record<string, unknown>; hash?: string }

/**
 * Where a link leads inside the site. Nothing for what the browser follows by itself: an
 * address on another site, a mail, an anchor of the page.
 */
export const siteAddress = (href: string): SiteAddress | undefined => {
  if (!href.startsWith('/') || href.startsWith('//')) return undefined
  const url = new URL(href, 'https://site.invalid')
  return {
    to: url.pathname,
    search: defaultParseSearch(url.search),
    ...(url.hash && { hash: url.hash.slice(1) }),
  }
}

// An opened card moves over the gallery by itself (ADR-0092): a fade would freeze it.
const CARDS_ADDRESS = /^\/atlas\/[^/]+\/cards(?:\/|$)/u

/** Whether a move is one from page to page, which fades. Other moves change the page in place. */
export const fadesToNextPage = (from: string | undefined, to: string): boolean =>
  from !== undefined && from !== to && !(CARDS_ADDRESS.test(from) && CARDS_ADDRESS.test(to))
