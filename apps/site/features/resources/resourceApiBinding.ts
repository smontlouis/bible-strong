// Server only: it reads what Cloudflare gives the Worker and the request being answered.
import { env } from 'cloudflare:workers'
import { getRequestHeader } from '@tanstack/react-start/server'

const READER_ADDRESS_HEADER = 'cf-connecting-ip'

const readerAddress = (): string | undefined => {
  try {
    return getRequestHeader(READER_ADDRESS_HEADER) ?? undefined
  } catch {
    // No request is being answered: a script, a test.
    return undefined
  }
}

/**
 * Asks the Resource API. The two Workers run on the same network: with the binding
 * (`RESOURCE_API` in `wrangler.jsonc`) the question does not go out to the Internet and back
 * (ADR-0083). The API counts what each address asks of it, and a question through the
 * binding has no address of its own, so it carries the address of the reader the page is
 * rendered for. Without the binding (development) the API is asked at its public address.
 */
export const resourceApiFetch = (url: URL | string, init: RequestInit): Promise<Response> => {
  const api = env.RESOURCE_API
  if (!api) return fetch(url, init)
  const headers = new Headers(init.headers)
  const address = readerAddress()
  if (address) headers.set(READER_ADDRESS_HEADER, address)
  return api.fetch(url, { ...init, headers })
}
