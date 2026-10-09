import { signedDescriptionOf, storageKeyOf } from './address'

type Env = {
  /** The public media bucket, where an image is kept once it is drawn. */
  MEDIA: R2Bucket
  /** The site that draws an image from its signed description. */
  SITE_ORIGIN: string
}

// An address names one description and one design: its image never changes.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

type Drawn = { body: ArrayBuffer; type: string }

// The site draws; this service only keeps. A description the site did not sign has no image,
// and a failure of the site is not kept.
const draw = async (env: Env, signed: string): Promise<Drawn | undefined> => {
  const answer = await fetch(new URL(`/share-card${signed ? `/${signed}` : ''}`, env.SITE_ORIGIN))
  const type = answer.headers.get('content-type') ?? ''
  if (!answer.ok || !type.startsWith('image/')) return undefined
  return { body: await answer.arrayBuffer(), type }
}

const imageResponse = (body: BodyInit, type: string, source: string) =>
  new Response(body, {
    headers: { 'content-type': type, 'cache-control': CACHE_CONTROL, 'x-share-card': source },
  })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 })
    }
    const signed = signedDescriptionOf(new URL(request.url))
    if (signed === undefined) return new Response('Not found', { status: 404 })
    const key = await storageKeyOf(signed)

    const stored = await env.MEDIA.get(key)
    if (stored) {
      return imageResponse(stored.body, stored.httpMetadata?.contentType ?? 'image/png', 'stored')
    }

    // A network that stops waiting must not lose the image for the next one: the drawing is
    // carried to its end, and kept, whether or not this request is still listening.
    const drawing = draw(env, signed).then(async image => {
      if (image) {
        await env.MEDIA.put(key, image.body, {
          httpMetadata: { contentType: image.type, cacheControl: CACHE_CONTROL },
        })
      }
      return image
    })
    ctx.waitUntil(drawing.catch(() => undefined))
    const image = await drawing
    if (!image) return new Response('Not found', { status: 404 })
    return imageResponse(image.body, image.type, 'drawn')
  },
}
