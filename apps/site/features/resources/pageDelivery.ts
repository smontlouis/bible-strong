import { STALE_PAGE_CACHE_CONTROL, STALE_PAGE_HEADER } from './pageReads'
import { RESOURCE_PAGE_CACHE_CONTROL } from './publicSite'

// Cloudflare keeps the pages the Worker renders in a cache of its own, in front of the
// entrypoint that renders them and shared by every data centre (ADR-0084). The gateway that
// receives every request names the key each page is kept under; this file says how.

// Added to a link by whoever shares it, and never read by a page.
const TRACKING_PARAMETERS = /^(?:utm_.+|fbclid|gclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid)$/u

/** Whether a parameter is one a sharer adds to a link, which no page reads. */
export const isTrackingParameter = (name: string): boolean => TRACKING_PARAMETERS.test(name)

/**
 * The key a page is kept under: the revision of the build that renders it, and its address
 * without what does not change it. A deployment of the same build keeps every page; a
 * deployment of another build starts anew, with no purge, since a page names the scripts and
 * styles of the build that rendered it.
 */
export const pageCacheKey = (url: URL, buildRevision: string): string => {
  const parameters = new URLSearchParams(url.search)
  for (const name of [...parameters.keys()]) {
    if (isTrackingParameter(name)) parameters.delete(name)
  }
  const search = parameters.toString()
  return `${buildRevision}:${url.pathname}${search ? `?${search}` : ''}`
}

/**
 * Where an address written with a slash at its end is read: at the same address without it.
 * The router sends the reader there too, but as a temporary move, which a search engine
 * does not take for the address of the page; the gateway answers before it, for good. The
 * answer names the site, so that no path can lead out of it.
 */
export const addressWithoutEndSlash = (url: URL): string | undefined => {
  if (!url.pathname.endsWith('/') || url.pathname === '/') return undefined
  return `${url.origin}${url.pathname.replace(/\/+$/u, '') || '/'}${url.search}`
}

/**
 * A permanent move the gateway answers by itself, from the address alone. Nothing is
 * rendered for it, so nothing is kept; the reader keeps it a day.
 */
export const permanentMove = (location: string): Response =>
  new Response(null, {
    status: 301,
    headers: { location, 'cache-control': 'public, max-age=86400' },
  })

const TAG_DEPTH = 3

/**
 * The names a kept page can be found again by, to render it anew before its time: one for
 * every page, and one for each of the first folders of its address (`/bible`, `/bible/lsg`,
 * `/bible/lsg/gen`). A tag is plain ASCII without a space; an address that is not gets none
 * past that point.
 */
export const pageCacheTags = (pathname: string): string[] => {
  const tags = ['page']
  const segments = pathname.split('/').filter(Boolean).slice(0, TAG_DEPTH)
  for (let depth = 1; depth <= segments.length; depth += 1) {
    const tag = pageTag(`/${segments.slice(0, depth).join('/')}`)
    if (!tag) break
    tags.push(tag)
  }
  return tags
}

/**
 * The reads the pages are filled with when the reader moves inside the site. Their addresses
 * say nothing of the page they fill, so they are all read again with any page.
 */
const PAGE_READS_TAG = 'path:_serverFn'

/** The tag of every page under a folder; nothing for a folder a tag cannot name. */
export const pageTag = (folder: string): string | undefined => {
  const path = folder.replace(/^\/+|\/+$/gu, '')
  return /^[\x21-\x7e]+$/u.test(path) && !path.includes(',') ? `path:${path}` : undefined
}

/**
 * How long the CDN keeps a page that does not exist: an hour. Crawlers come back to
 * addresses that never existed, and a resource published meanwhile soon has its page.
 */
export const MISSING_PAGE_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600'

// Answers made of what a reader or an author keeps, which change at any time: a server
// function reads for the page a reader is on unless it says otherwise, a study is published or
// withdrawn by its author.
const UNPUBLISHED_PATHS = /^\/(?:_serverFn|(?:fr\/)?studies)(?:\/|$)/u

/**
 * How long an answer whose route said nothing about its keeping is kept, by what it is. A
 * permanent move is decided from the address and the published resources only: it is kept
 * like a page. A missing page is kept an hour. A failure is not kept: while a page kept
 * before is served stale, Cloudflare keeps it and tries again, which a failure it kept would
 * replace. An answer made from a STALE answer of the Resource API is kept a minute.
 */
const untoldKeeping = (response: Response, pathname: string): string | undefined => {
  if (UNPUBLISHED_PATHS.test(pathname)) return undefined
  const moved = response.status === 301 || response.status === 308
  if (!moved && response.status !== 404) return undefined
  if (response.headers.get(STALE_PAGE_HEADER) === '1') return STALE_PAGE_CACHE_CONTROL
  return moved ? RESOURCE_PAGE_CACHE_CONTROL : MISSING_PAGE_CACHE_CONTROL
}

/**
 * What a rendered answer is sent with. Cloudflare keeps for two hours an answer that says
 * nothing about its keeping: only an answer whose route asked for it, a permanent move or a
 * missing page is kept, and every other one is marked as the reader's own. A kept answer
 * carries the tags it is found again by.
 */
export const deliveredPage = (response: Response, pathname: string): Response => {
  const delivered = new Response(response.body, response)
  const cacheControl =
    delivered.headers.get('cache-control') ?? untoldKeeping(delivered, pathname)
  if (!cacheControl) {
    delivered.headers.set('cache-control', 'private')
    return delivered
  }
  delivered.headers.set('cache-control', cacheControl)
  if (/\bs-maxage=[1-9]/iu.test(cacheControl) && !/\bprivate\b/iu.test(cacheControl)) {
    delivered.headers.set('cache-tag', pageCacheTags(pathname).join(','))
  }
  return delivered
}

/**
 * What every answer of the Worker is sent with, kept or not: the site and its subdomains
 * are read over HTTPS only, no other site frames its pages, a file is read as the type it is
 * sent as, and another site learns of a reader only the origin they come from. The public
 * files have their own headers (`public/_headers`).
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

/** An answer with the security headers it does not set itself. */
export const withSecurityHeaders = (response: Response): Response => {
  const secured = new Response(response.body, response)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!secured.headers.has(name)) secured.headers.set(name, value)
  }
  return secured
}

export type PageRefresh = { everything: true } | { tags: string[] }

/**
 * Reads which pages the operator asks to be rendered again: `{"everything": true}`, or
 * `{"paths": ["/bible/lsg", "/strong"]}` for the pages under those folders.
 */
export const readPageRefresh = (body: unknown): PageRefresh | undefined => {
  if (typeof body !== 'object' || body === null) return undefined
  const { everything, paths } = body as { everything?: unknown; paths?: unknown }
  if (everything === true) return { everything: true }
  if (!Array.isArray(paths) || paths.length === 0) return undefined
  const tags = paths.map(path => (typeof path === 'string' ? pageTag(path) : undefined))
  return tags.every(tag => tag !== undefined)
    ? { tags: [...(tags as string[]), PAGE_READS_TAG] }
    : undefined
}
