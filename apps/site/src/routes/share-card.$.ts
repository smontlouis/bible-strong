import { createFileRoute } from '@tanstack/react-router'
import { renderShareCard } from '@/features/share/shareCardImage'
import { readShareCardMeta } from '@/features/share/shareCardMeta'

// `/share-card/<path of a public page>`: the image shown when that page is shared. The page
// itself says what the image shows (`shareCardMeta`); a page that says nothing gets the
// default card, and a path that is no page gets no image.
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
            'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
          },
        })
      },
    },
  },
})
