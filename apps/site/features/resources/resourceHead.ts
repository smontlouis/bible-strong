import {
  absoluteSiteUrl,
  RESOURCE_FONT_PRELOADS,
  type ResourceLanguage,
} from './publicSite'
import type { ShareCardContent } from '@bible-strong/share-card-service/content'
import { shareCardMeta } from '../share/shareCardMeta'

/** A step of the path leading to a page; the last one is the page itself. */
export type Breadcrumb = { label: string; path?: string }

export type ResourceHeadInput = {
  title: string
  description: string
  /** The canonical path of the page, query string included when it is part of its identity. */
  path: string
  language: ResourceLanguage
  /** The same page in each language, when it exists in both. */
  alternates?: Partial<Record<ResourceLanguage, string>>
  /** False for a filter or a variant that only rearranges an indexable page. */
  indexable?: boolean
  breadcrumbs?: Breadcrumb[]
  /** schema.org objects describing the page. */
  structuredData?: Record<string, unknown>[]
  ogType?: 'article' | 'website'
  /** What the share image of the page shows; the default card when it says nothing. */
  shareCard?: ShareCardContent
}

const structuredDataScript = (item: Record<string, unknown>) => ({
  type: 'application/ld+json',
  // `<` is escaped so editorial text can never close the script element.
  children: JSON.stringify(item).replace(/</gu, '\\u003c'),
})

const breadcrumbList = (breadcrumbs: Breadcrumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((breadcrumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: breadcrumb.label,
    ...(breadcrumb.path ? { item: absoluteSiteUrl(breadcrumb.path) } : {}),
  })),
})

/** The schema.org path of a page, for a head assembled outside `buildResourceHead`. */
export const breadcrumbScripts = (breadcrumbs: Breadcrumb[]) =>
  breadcrumbs.length > 1 ? [structuredDataScript(breadcrumbList(breadcrumbs))] : []

/** Title, description, canonical, language alternates and structured data of a resource page. */
export const buildResourceHead = ({
  title,
  description,
  path,
  language,
  alternates,
  indexable = true,
  breadcrumbs,
  structuredData = [],
  ogType = 'article',
  shareCard,
}: ResourceHeadInput) => {
  const url = absoluteSiteUrl(path)
  const data = [...(breadcrumbs && breadcrumbs.length > 1 ? [breadcrumbList(breadcrumbs)] : []), ...structuredData]
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      ...(indexable ? [] : [{ name: 'robots', content: 'noindex, follow' }]),
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: ogType },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'Bible Strong' },
      { property: 'og:locale', content: language === 'fr' ? 'fr_FR' : 'en_US' },
      ...shareCardMeta(shareCard),
    ],
    links: [
      ...RESOURCE_FONT_PRELOADS,
      { rel: 'canonical', href: url },
      ...Object.entries(alternates ?? {}).map(([hrefLang, alternatePath]) => ({
        rel: 'alternate',
        hrefLang,
        href: absoluteSiteUrl(alternatePath),
      })),
    ],
    scripts: data.map(structuredDataScript),
  }
}
