import { createFileRoute } from '@tanstack/react-router'
import { renderSitemap, xmlResponse } from '@/features/resources/sitemap'
import { SITEMAPS } from '@/features/resources/sitemapRegistry'

export const Route = createFileRoute('/sitemaps/$name')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const list = SITEMAPS[params.name]
        if (!list) return new Response('Not found', { status: 404 })
        return xmlResponse(renderSitemap(await list()))
      },
    },
  },
})
