import { WorkerEntrypoint } from 'cloudflare:workers'
import handler from '@tanstack/react-start/server-entry'
import { BUILD_REVISION } from '@/features/resources/buildRevision'
import {
  addressWithoutEndSlash,
  deliveredPage,
  pageCacheKey,
  readPageRefresh,
  type PageRefresh,
} from '@/features/resources/pageDelivery'

// The Worker the site runs as (ADR-0083, ADR-0084). Public files are answered by Cloudflare
// before it is reached. Every other request comes to the gateway below, which hands a read
// to `Pages`: Cloudflare keeps the answers of that entrypoint, for every data centre, and
// does not run it again while an answer is kept.

/** Where the operator asks for kept pages to be rendered again (`scripts/refresh-pages.mjs`). */
const REFRESH_PATH = '/__cache/refresh'

/** Renders a page. Its answers are the ones Cloudflare keeps (`wrangler.jsonc`). */
export class Pages extends WorkerEntrypoint {
  async fetch(request: Request): Promise<Response> {
    return deliveredPage(await handler.fetch(request), new URL(request.url).pathname)
  }

  /** Removes kept pages. An entrypoint reaches no cache but its own, hence this one. */
  async refresh(selection: PageRefresh): Promise<void> {
    await this.ctx.cache.purge(
      'everything' in selection ? { purgeEverything: true } : { tags: selection.tags }
    )
  }
}

const digest = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

// Compared through their digests, so that the time taken says nothing of the secret.
const sameSecret = async (given: string, expected: string): Promise<boolean> => {
  const [left, right] = await Promise.all([digest(given), digest(expected)])
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!
  return difference === 0
}

const refreshPages = async (
  request: Request,
  env: WorkerEnv,
  ctx: WorkerExecutionContext
): Promise<Response> => {
  const secret = env.CACHE_REFRESH_SECRET
  const given = /^Bearer (.+)$/u.exec(request.headers.get('authorization') ?? '')?.[1]
  // Without the secret the address does not exist, for whoever asks.
  if (request.method !== 'POST' || !secret || !given || !(await sameSecret(given, secret))) {
    return new Response('Not found', { status: 404 })
  }
  const selection = readPageRefresh(await request.json().catch(() => undefined))
  if (!selection) return new Response('Bad request', { status: 400 })
  await (ctx.exports.Pages as unknown as Pages).refresh(selection)
  return Response.json({ refreshed: selection })
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === REFRESH_PATH) return refreshPages(request, env, ctx)
    const isRead = request.method === 'GET' || request.method === 'HEAD'
    const moved = isRead ? addressWithoutEndSlash(url) : undefined
    if (moved) return Response.redirect(moved, 301)
    // Only a read is kept, and nothing on the development server, which has no build.
    if (!BUILD_REVISION || !isRead) return handler.fetch(request)
    return ctx.exports.Pages!.fetch(request, {
      cf: { cacheKey: pageCacheKey(url, BUILD_REVISION) },
    } as RequestInit)
  },
}
