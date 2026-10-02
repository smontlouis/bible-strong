/// <reference lib="webworker" />
// Expo Web service worker (ADR-0067). Bundled by scripts/build-web-sw.mjs after `expo export`.
// It caches the application shell only: editorial content and API responses stay online-only.
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Replaced at build time by @serwist/build's injectManifest.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const isNavigation = ({ request }: { request: Request }) => request.mode === 'navigate'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    // `/` must follow the network-first navigation rule below, not the precached index.html.
    directoryIndex: null,
    cleanURLs: false,
  },
  // A new worker waits until the page accepts the update prompt (SKIP_WAITING message).
  skipWaiting: false,
  // The first worker takes control at once so the open page works offline.
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      // Navigations always try the network so a reload picks up the latest deployment.
      // Offline or after the timeout, the fallback below serves the precached shell.
      matcher: isNavigation,
      handler: new NetworkOnly({ networkTimeoutSeconds: 4 }),
    },
    {
      // Content-hashed same-origin files that are not precached (images, optional fonts…).
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_expo/static/')),
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 60 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: '/index.html', matcher: isNavigation }],
  },
})

serwist.addEventListeners()
