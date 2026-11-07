import { WorkerEntrypoint } from 'cloudflare:workers'

import type { LibrarySearchResult } from '../repositories/librarySearchRepository'

/**
 * Library search for the study assistant (ADR-0103). A named entrypoint is reachable only
 * through a service binding that names it, never from the Internet: no public route, no
 * shared per-address limit. The assistant applies its own per-reader limits.
 */
export class LibrarySearch extends WorkerEntrypoint<Env> {
  async search(input: unknown): Promise<LibrarySearchResult> {
    const { runLibrarySearch } = await import('./librarySearchOrigin')
    return runLibrarySearch(this.env, input)
  }
}
