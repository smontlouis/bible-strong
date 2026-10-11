// Cloudflare keeps the pages the Worker renders in a cache of its own, in front of the
// entrypoint that renders them and shared by every data centre (ADR-0084). The gateway that
// receives every request names the key each page is kept under; this file says how.

// Added to a link by whoever shares it, and never read by a page.
const TRACKING_PARAMETERS = /^(?:utm_.+|fbclid|gclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid)$/u

/**
 * The key a page is kept under: the revision of the build that renders it, and its address
 * without what does not change it. A deployment of the same build keeps every page; a
 * deployment of another build starts anew, with no purge, since a page names the scripts and
 * styles of the build that rendered it.
 */
export const pageCacheKey = (url: URL, buildRevision: string): string => {
  const parameters = new URLSearchParams(url.search)
  for (const name of [...parameters.keys()]) {
    if (TRACKING_PARAMETERS.test(name)) parameters.delete(name)
  }
  const search = parameters.toString()
  return `${buildRevision}:${url.pathname}${search ? `?${search}` : ''}`
}

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

/** The tag of every page under a folder; nothing for a folder a tag cannot name. */
export const pageTag = (folder: string): string | undefined => {
  const path = folder.replace(/^\/+|\/+$/gu, '')
  return /^[\x21-\x7e]+$/u.test(path) && !path.includes(',') ? `path:${path}` : undefined
}

/**
 * What a rendered answer is sent with. Cloudflare keeps for two hours an answer that says
 * nothing about its keeping: only an answer whose route asked for it is kept, so every other
 * one is marked as the reader's own. A kept answer carries the tags it is found again by.
 */
export const deliveredPage = (response: Response, pathname: string): Response => {
  const delivered = new Response(response.body, response)
  const cacheControl = delivered.headers.get('cache-control')
  if (!cacheControl) {
    delivered.headers.set('cache-control', 'private')
  } else if (/\bs-maxage=[1-9]/iu.test(cacheControl) && !/\bprivate\b/iu.test(cacheControl)) {
    delivered.headers.set('cache-tag', pageCacheTags(pathname).join(','))
  }
  return delivered
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
  return tags.every(tag => tag !== undefined) ? { tags: tags as string[] } : undefined
}
