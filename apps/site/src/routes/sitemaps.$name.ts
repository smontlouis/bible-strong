import { createFileRoute } from '@tanstack/react-router'
import { renderSitemap, xmlResponse } from '@/features/resources/sitemap'
import { SITEMAPS } from '@/features/resources/sitemapRegistry'

export const Route = createFileRoute('/sitemaps/$name')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Only a sitemap of the registry: `constructor` and the like are not sitemaps.
        const list = Object.hasOwn(SITEMAPS, params.name) ? SITEMAPS[params.name] : undefined
        if (!list) return new Response('Not found', { status: 404 })
        return xmlResponse(renderSitemap(await list()))
      },
    },
  },
})
