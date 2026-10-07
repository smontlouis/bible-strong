import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  plugins: [
    nitro({
      vercel: {
        functions: {
          // Pages are rendered from the Resource API, whose database is in Frankfurt: a
          // function on another continent pays that distance on every read.
          regions: ['fra1'],
          // A page not yet cached reads the API several times in a row.
          maxDuration: 30,
        },
      },
    }),
    tanstackStart(),
    tailwindcss(),
    svgr(),
    mdx({ providerImportSource: '@/mdx-components' }),
    viteReact(),
  ],
})
