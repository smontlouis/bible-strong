import { cloudflare } from '@cloudflare/vite-plugin'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'
import { buildRevision } from './bundling/buildRevision'
import { satoriForWorkers } from './bundling/satoriForWorkers'

const ANIMATIONS_ON_SERVER = fileURLToPath(new URL('./bundling/animationsOnServer.ts', import.meta.url))
const ANIMATION_MODULES = new Set(['gsap', 'gsap/ScrollTrigger', '@gsap/react'])

// The animation library is only loaded by the browser (see `bundling/animationsOnServer.ts`).
const animationsStayInTheBrowser = (): Plugin => ({
  name: 'animations-stay-in-the-browser',
  enforce: 'pre',
  resolveId(source) {
    return this.environment.name === 'ssr' && ANIMATION_MODULES.has(source)
      ? ANIMATIONS_ON_SERVER
      : undefined
  },
})

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    // A shared package that renders with React (@bible-strong/biblical-map) has none of its own.
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    satoriForWorkers(),
    animationsStayInTheBrowser(),
    buildRevision(),
    // The site runs as a Cloudflare Worker (ADR-0083): the server build is made for workerd,
    // and `vite dev` runs it there too, with the bindings of `wrangler.jsonc`.
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    tailwindcss(),
    svgr(),
    mdx({ providerImportSource: '@/mdx-components' }),
    viteReact(),
  ],
})
