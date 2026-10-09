import { pagePathOf, storageKeyOf } from './address'

type Env = {
  /** The public media bucket, where an image is kept once it is drawn. */
  MEDIA: R2Bucket
  /** The site that draws the image of each of its pages. */
  SITE_ORIGIN: string
}

// A stored image is served as it is. Past this age it is also drawn again, in the
// background, so that a corrected text reaches its image within the week.
const REDRAW_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_CONTROL = 'public, max-age=86400'

type Drawn = { body: ArrayBuffer; type: string }

// The site draws; this service only keeps. An address that is no page of the site has no
// image, and a failure of the site is not kept either.
const draw = async (env: Env, pagePath: string): Promise<Drawn | undefined> => {
  const answer = await fetch(new URL(`/share-card${pagePath === '/' ? '' : pagePath}`, env.SITE_ORIGIN))
  const type = answer.headers.get('content-type') ?? ''
  if (!answer.ok || !type.startsWith('image/')) return undefined
  return { body: await answer.arrayBuffer(), type }
}

const keep = (env: Env, key: string, image: Drawn) =>
  env.MEDIA.put(key, image.body, {
    httpMetadata: { contentType: image.type, cacheControl: CACHE_CONTROL },
  })

const imageResponse = (body: BodyInit, type: string, source: string) =>
  new Response(body, {
    headers: { 'content-type': type, 'cache-control': CACHE_CONTROL, 'x-share-card': source },
  })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 })
    }
    const pagePath = pagePathOf(new URL(request.url))
    if (!pagePath) return new Response('Not found', { status: 404 })
    const key = storageKeyOf(pagePath)

    const stored = await env.MEDIA.get(key)
    if (stored) {
      const type = stored.httpMetadata?.contentType ?? 'image/png'
      if (Date.now() - stored.uploaded.getTime() >= REDRAW_AFTER_MS) {
        // The reader gets the image that is there; a failed redraw leaves it in place.
        ctx.waitUntil(
          draw(env, pagePath)
            .then(image => image && keep(env, key, image))
            .catch(() => undefined)
        )
      }
      return imageResponse(stored.body, type, 'stored')
    }

    // A network that stops waiting must not lose the image for the next one: the drawing is
    // carried to its end, and kept, whether or not this request is still listening.
    const drawing = draw(env, pagePath).then(async image => {
      if (image) await keep(env, key, image)
      return image
    })
    ctx.waitUntil(drawing.catch(() => undefined))
    const image = await drawing
    if (!image) return new Response('Not found', { status: 404 })
    return imageResponse(image.body, image.type, 'drawn')
  },
}
