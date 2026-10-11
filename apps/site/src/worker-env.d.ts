// What the Worker is given by Cloudflare (`wrangler.jsonc`). Declared by hand: the full
// runtime types of Workers redeclare the DOM types the pages are written against.

type WorkerFetcher = { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> }

/** What may be removed from the cache of an entrypoint. */
type CacheSelection =
  | { purgeEverything: true }
  | { tags?: string[]; pathPrefixes?: string[] }

type WorkerCache = {
  purge(selection: CacheSelection): Promise<unknown>
}

type WorkerExecutionContext<Props = unknown> = {
  props: Props
  cache: WorkerCache
  waitUntil(task: Promise<unknown>): void
  /** The other entrypoints of this Worker, each behind its own cache. */
  exports: Record<
    string,
    WorkerFetcher & {
      fetch(request: Request, init?: RequestInit): Promise<Response>
      [method: string]: (...args: never[]) => Promise<unknown>
    }
  >
}

type WorkerEnv = {
  /** The public files of the site: fonts, pictures, the browser build. */
  ASSETS: WorkerFetcher
  /** The Resource API, asked without leaving Cloudflare. */
  RESOURCE_API?: WorkerFetcher
  /** Lets the operator ask for cached pages to be rendered again. */
  CACHE_REFRESH_SECRET?: string
}

declare module 'cloudflare:workers' {
  export const env: WorkerEnv
  /** Lets a task finish after the response is sent. */
  export function waitUntil(promise: Promise<unknown>): void
  export abstract class WorkerEntrypoint<Env = WorkerEnv, Props = unknown> {
    protected ctx: WorkerExecutionContext<Props>
    protected env: Env
  }
}

// A WebAssembly file is imported compiled: a Worker may not compile one while it runs.
declare module '*.wasm' {
  const module: WebAssembly.Module
  export default module
}
