import { createFileRoute } from '@tanstack/react-router'
import { absoluteSiteUrl } from '@/features/resources/publicSite'
import { renderSitemapIndex, xmlResponse } from '@/features/resources/sitemap'
import { listAnnouncedSitemaps } from '@/features/resources/sitemapRegistry'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        xmlResponse(
          renderSitemapIndex(
            listAnnouncedSitemaps().map(name => absoluteSiteUrl(`/sitemaps/${name}`))
          )
        ),
    },
  },
})
