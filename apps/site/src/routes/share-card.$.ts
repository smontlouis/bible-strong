import { readShareCardMeta } from '@bible-strong/share-card-service/content'
import { createFileRoute } from '@tanstack/react-router'
import { renderShareCard } from '@/features/share/shareCardImage'

// `/share-card/<path of a public page>` draws the image shown when that page is shared. The
// page itself says what the image shows (`shareCardMeta`); a page that says nothing gets the
// default card, and a path that is no page gets no image. Readers never come here: the pages
// name their image on the share card service, which asks this route once and keeps the answer.
export const Route = createFileRoute('/share-card/$')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { origin, search } = new URL(request.url)
        const page = await fetch(new URL(`/${params._splat ?? ''}${search}`, origin), {
          headers: { accept: 'text/html' },
        })
        if (!page.ok) return new Response('Not found', { status: 404 })
        const content = readShareCardMeta(await page.text()) ?? { kind: 'default' as const }
        const image = await renderShareCard(content, origin)
        return new Response(image.body, {
          headers: {
            'content-type': image.type,
            // The service keeps the image; this answer itself is not worth keeping long.
            'cache-control': 'public, max-age=0, s-maxage=3600',
          },
        })
      },
    },
  },
})
