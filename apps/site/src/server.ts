import { env, waitUntil } from 'cloudflare:workers'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { renderThroughPageCache, type PageCache } from '@/features/resources/pageCache'

// The Worker the site runs as (ADR-0083). Public files are answered by Cloudflare before it
// is reached; every other request is rendered here, through the page cache.
const pageCache = (): PageCache => (caches as unknown as { default: PageCache }).default

export default createServerEntry({
  fetch: request =>
    renderThroughPageCache(request, {
      cache: pageCache(),
      // The development server renders every request: no deployment is being run there.
      version: import.meta.env.DEV ? undefined : env.CF_VERSION_METADATA?.id,
      render: async rendered => handler.fetch(rendered),
      defer: waitUntil,
    }),
})
