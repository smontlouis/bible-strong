import { createFileRoute } from '@tanstack/react-router'
import { readSignedShareCard, shareCardSecret } from '@/features/share/shareCardAddress'
import { renderShareCard } from '@/features/share/shareCardImage'

// `/share-card/<signed description>` draws the image shown when a page is shared, from that
// description alone; `/share-card` draws the default card. A description the site did not
// sign gets no image. Readers never come here: the pages name their image on the share card
// service, which asks this route once and keeps the answer.
export const Route = createFileRoute('/share-card/$')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const signed = params._splat ?? ''
        const secret = shareCardSecret()
        const content = signed
          ? secret && readSignedShareCard(signed, secret)
          : ({ kind: 'default' } as const)
        if (!content) return new Response('Not found', { status: 404 })
        const image = await renderShareCard(content, new URL(request.url).origin)
        const timing = Object.entries(image.timings)
          .map(([step, duration]) => `${step};dur=${duration.toFixed(0)}`)
          .join(', ')
        return new Response(image.body, {
          headers: {
            'content-type': image.type,
            // The service keeps the image; this answer itself is not worth keeping long.
            'cache-control': 'public, max-age=0, s-maxage=3600',
            // Loading fonts and rasteriser, laying out, drawing the pixels.
            'server-timing': timing,
          },
        })
      },
    },
  },
})
