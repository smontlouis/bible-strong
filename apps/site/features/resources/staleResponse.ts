// Server only: it reads and writes the response being built. Import it where the browser
// build drops the import: inside a server function, or the server side of an isomorphic one.
import { getResponseHeader, setResponseHeader } from '@tanstack/react-start/server'
import { STALE_PAGE_CACHE_CONTROL, STALE_PAGE_HEADER } from './pageReads'
import { RESOURCE_PAGE_CACHE_CONTROL } from './publicSite'

/**
 * Marks the response being built as using a STALE answer of the Resource API. The mark is
 * the header the response is sent with, so nothing is passed from loader to loader:
 * whoever decides how long the response is kept reads it there.
 */
export const markResponseStale = (): void => {
  try {
    setResponseHeader(STALE_PAGE_HEADER, '1')
  } catch {
    // No response is being built: a script, a test.
  }
}

/** Whether a read made for the response being built was given a STALE answer. */
export const responseIsStale = (): boolean => {
  try {
    return getResponseHeader(STALE_PAGE_HEADER) === '1'
  } catch {
    return false
  }
}

/**
 * What the CDN is told about a response a server function builds itself, a preview: kept
 * like a page, and like a page for a minute only when a STALE answer came into it.
 */
export const resourceResponseCacheControl = (): string =>
  responseIsStale() ? STALE_PAGE_CACHE_CONTROL : RESOURCE_PAGE_CACHE_CONTROL
