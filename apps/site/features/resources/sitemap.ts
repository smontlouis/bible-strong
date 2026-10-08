import { escapeHtml } from './editorialHtml'
import { STALE_PAGE_CACHE_CONTROL } from './pageReads'
import { responseIsStale } from './staleResponse'

// A sitemap is rebuilt from the Resource API, so the CDN keeps it for a day.
const SITEMAP_CACHE_CONTROL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

export type SitemapUrl = {
  loc: string
  /** Language alternates of the same resource, `loc` included. */
  alternates?: { hrefLang: string; href: string }[]
}

export const renderSitemapIndex = (sitemaps: string[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map(loc => `<sitemap><loc>${escapeHtml(loc)}</loc></sitemap>`),
    '</sitemapindex>',
  ].join('\n')

export const renderSitemap = (urls: SitemapUrl[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls.map(
      ({ loc, alternates = [] }) =>
        `<url><loc>${escapeHtml(loc)}</loc>${alternates
          .map(
            alternate =>
              `<xhtml:link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(alternate.href)}"/>`
          )
          .join('')}</url>`
    ),
    '</urlset>',
  ].join('\n')

// A sitemap listed from a STALE answer of the Resource API is kept a minute, like a page.
export const xmlResponse = (xml: string): Response =>
  new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': responseIsStale() ? STALE_PAGE_CACHE_CONTROL : SITEMAP_CACHE_CONTROL,
    },
  })
