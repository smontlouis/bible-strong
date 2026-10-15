import { workshopDocuments } from './src/workshop/documents'
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const MAX_BODY_BYTES = 1024 * 1024

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      size += buffer.byteLength
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Document is too large'))
        request.destroy()
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/** Workshop saves: one endpoint per project document, validated before an atomic write. */
function workshopDocumentsPlugin(): Plugin {
  return {
    name: 'study-world-workshop-documents',
    apply: 'serve',
    configureServer(server) {
      for (const document of workshopDocuments)
        server.middlewares.use(document.endpoint, async (request, response) => {
          if (request.method !== 'PUT') {
            response.statusCode = 405
            response.setHeader('Allow', 'PUT')
            response.end('Method Not Allowed')
            return
          }
          if (
            request.headers.origin &&
            request.headers.origin !== `http://${request.headers.host}` &&
            request.headers.origin !== `https://${request.headers.host}`
          ) {
            response.statusCode = 403
            response.end('Forbidden')
            return
          }
          try {
            const value = document.parse(JSON.parse(await readBody(request)))
            const file = resolve(server.config.root, document.file)
            await mkdir(dirname(file), { recursive: true })
            const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
            await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
            await rename(temporary, file)
            response.statusCode = 204
            response.end()
          } catch (error) {
            response.statusCode = error instanceof SyntaxError ? 400 : 422
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Save failed' }))
          }
        })
    },
  }
}

/** Dev-only bridge: credentials never reach browser code or LAN clients. */
function localGuestbookAdmin(): Plugin {
  return {
    name: 'local-guestbook-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/guestbook/admin') return next()
        const address = request.socket.remoteAddress
        const host = request.headers.host
        const origin = request.headers.origin
        if (
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '') ||
          !host ||
          !/^(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(host) ||
          (origin && origin !== `http://${host}`)
        ) {
          response.statusCode = 403
          response.end('Forbidden')
          return
        }
        try {
          const vars = await readFile(resolve(server.config.root, '.dev.vars'), 'utf8')
          const token = vars.match(/^GUESTBOOK_LOCAL_ADMIN_TOKEN=([a-f0-9]{64})$/m)?.[1]
          if (token) request.headers.authorization = `Bearer ${token}`
        } catch {
          /* Worker rejects unconfigured access. */
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    localGuestbookAdmin(),
    workshopDocumentsPlugin(),
  ],
  // Saving editor documents should not reload the world mid-edit.
  server: {
    proxy: {
      '/api/guestbook': { target: 'http://127.0.0.1:8791' },
      '/parties': { target: 'http://127.0.0.1:8791', ws: true },
    },
    watch: {
      ignored: workshopDocuments.map(document => `**/${document.file}`),
    },
  },
  base: '/',
  build: {
    rolldownOptions: {
      // Valence 1876 has its own page for link previews; both pages share main.tsx.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        valence: resolve(import.meta.dirname, 'valence-1876/index.html'),
      },
    },
  },
})
