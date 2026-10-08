import { RESOURCE_PAGE_CACHE_CONTROL } from '../resources/publicSite'

/**
 * How many reads a page keeps in flight. The Resource API answers a few reads at once in a
 * steady time; out of a dozen sent together, some wait several hundred milliseconds, and the
 * page waits with them.
 */
export const PAGE_READ_CONCURRENCY = 6

/** The reads one page makes around its text: a few at a time, and what they could not read. */
export type PageReads = {
  /** Starts a read once fewer than the limit are in flight, in the order they were asked. */
  queue: <Result>(read: () => Promise<Result>) => Promise<Result>
  /**
   * Queues a read the page can do without: when it fails, its part is left out and the page
   * is incomplete. A resource that does not exist is not a failure.
   */
  optional: <Result>(read: () => Promise<Result>) => Promise<Result | undefined>
  /** Records a part left out because it could not be read, for a read made elsewhere. */
  missed: () => void
  /**
   * Whether a part of the page is missing because it could not be read. Such a page is
   * worth showing and not worth keeping: the next reader should get the whole of it.
   */
  readonly incomplete: boolean
}

export const createPageReads = (concurrency = PAGE_READ_CONCURRENCY): PageReads => {
  let inFlight = 0
  let incomplete = false
  const waiting: (() => void)[] = []

  // A read that ends hands its place to the next one waiting, so the limit is never passed.
  const release = () => {
    const next = waiting.shift()
    if (next) next()
    else inFlight -= 1
  }
  const queue = async <Result>(read: () => Promise<Result>): Promise<Result> => {
    if (inFlight < concurrency) inFlight += 1
    else await new Promise<void>(resolve => waiting.push(resolve))
    try {
      return await read()
    } finally {
      release()
    }
  }

  return {
    queue,
    optional: read =>
      queue(read).catch(() => {
        incomplete = true
        return undefined
      }),
    missed: () => {
      incomplete = true
    },
    get incomplete() {
      return incomplete
    },
  }
}

/**
 * How long the CDN keeps a page missing a part it could not read: a minute, and never
 * stale. Long enough that the readers of that minute do not each render it again while the
 * Resource API is refusing reads, short enough that the whole page soon takes its place.
 */
export const INCOMPLETE_PAGE_CACHE_CONTROL = 'public, max-age=0, s-maxage=60'

/**
 * What the CDN is told about a rendered page. Only a whole page is kept for long: a page
 * missing a part it could not read would otherwise be the thin page every reader gets for
 * as long as the CDN keeps it. A failed load is not kept at all.
 */
export const pageCacheHeaders = (
  page: { incomplete?: boolean } | undefined
): Record<string, string> | undefined =>
  page && {
    'Cache-Control': page.incomplete ? INCOMPLETE_PAGE_CACHE_CONTROL : RESOURCE_PAGE_CACHE_CONTROL,
  }
