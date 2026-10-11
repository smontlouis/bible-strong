// What the Worker is given by Cloudflare (`wrangler.jsonc`). Declared by hand: the full
// runtime types of Workers redeclare the DOM types the pages are written against.

type WorkerFetcher = { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> }

declare module 'cloudflare:workers' {
  export const env: {
    /** The public files of the site: fonts, pictures, the browser build. */
    ASSETS: WorkerFetcher
    /** The Resource API, asked without leaving Cloudflare. Absent in development. */
    RESOURCE_API?: WorkerFetcher
    /** The version of the Worker being run: a deployment has its own page cache. */
    CF_VERSION_METADATA?: { id: string }
  }
  /** Lets a task finish after the response is sent. */
  export function waitUntil(promise: Promise<unknown>): void
}

// A WebAssembly file is imported compiled: a Worker may not compile one while it runs.
declare module '*.wasm' {
  const module: WebAssembly.Module
  export default module
}
