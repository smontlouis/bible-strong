import { createFileRoute } from '@tanstack/react-router'
import { loadShareCardContent } from '@/features/share/shareCardContent'
import { renderShareCardPng } from '@/features/share/shareCardImage'

// `/share-card/<path of a public page>`: the image shown when that page is shared.
export const Route = createFileRoute('/share-card/$')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const started = Date.now()
        const content = await loadShareCardContent(params._splat ?? '')
        const png = await renderShareCardPng(content, new URL(request.url).origin)
        return new Response(png, {
          headers: {
            'content-type': 'image/png',
            'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
            'server-timing': `card;dur=${Date.now() - started}`,
          },
        })
      },
    },
  },
})
