import { parseAmbientZones } from './src/ambient-zones'
import { parseShorelines } from './src/shorelines'
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const NAVIGATION_API = '/__study-world/navigation'
const NAVIGATION_FILE = 'public/navigation/archipelago.json'
const MAX_BODY_BYTES = 1024 * 1024

function validateNavigationDocument(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invalid navigation document')
  const document = value as Record<string, unknown>
  const revision = document.obstacleRevision
  if (
    document.version !== 1 ||
    document.map !== 'archipelago' ||
    document.width !== 1671 ||
    document.height !== 941 ||
    !Array.isArray(document.zones) ||
    document.zones.length > 500 ||
    (revision !== undefined &&
      (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1 || revision > 2))
  )
    throw new Error('Incompatible navigation document')

  const ids = new Set<string>()
  for (const rawZone of document.zones) {
    if (!rawZone || typeof rawZone !== 'object') throw new Error('Invalid zone')
    const zone = rawZone as Record<string, unknown>
    if (
      typeof zone.id !== 'string' ||
      !zone.id.trim() ||
      ids.has(zone.id) ||
      typeof zone.name !== 'string' ||
      !zone.name.trim() ||
      (zone.kind !== 'allowed' && zone.kind !== 'blocked') ||
      !Array.isArray(zone.points) ||
      zone.points.length < 3 ||
      zone.points.length > 256 ||
      !zone.points.every(
        point =>
          Array.isArray(point) &&
          point.length === 2 &&
          point.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))
      )
    )
      throw new Error('Invalid zone')
    ids.add(zone.id)
  }
  if (!document.zones.some(zone => (zone as Record<string, unknown>).kind === 'allowed'))
    throw new Error('No walkable zone')
  return document
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      size += buffer.byteLength
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Navigation document is too large'))
        request.destroy()
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function navigationSavePlugin(): Plugin {
  return {
    name: 'study-world-navigation-save',
    configureServer(server) {
      server.middlewares.use(NAVIGATION_API, async (request, response) => {
        if (request.method !== 'PUT') {
          response.statusCode = 405
          response.setHeader('Allow', 'PUT')
          response.end('Method Not Allowed')
          return
        }

        try {
          const document = validateNavigationDocument(JSON.parse(await readBody(request)))
          const file = resolve(server.config.root, NAVIGATION_FILE)
          await mkdir(dirname(file), { recursive: true })
          const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`
          await writeFile(temporaryFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
          await rename(temporaryFile, file)
          response.statusCode = 204
          response.end()
        } catch (error) {
          response.statusCode = error instanceof SyntaxError ? 400 : 422
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Save failed' })
          )
        }
      })
    },
  }
}

function sceneDocumentSavePlugin(
  kind: 'shorelines' | 'ambience',
  parse: (value: unknown) => unknown
): Plugin {
  return {
    name: `study-world-${kind}-save`,
    configureServer(server) {
      server.middlewares.use(`/__study-world/${kind}`, async (request, response) => {
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
          const lines = parse(JSON.parse(await readBody(request)))
          const file = resolve(server.config.root, `public/${kind}/archipelago.json`)
          await mkdir(dirname(file), { recursive: true })
          const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
          await writeFile(temporary, `${JSON.stringify(lines, null, 2)}\n`, 'utf8')
          await rename(temporary, file)
          response.statusCode = 204
          response.end()
        } catch (error) {
          response.statusCode = error instanceof SyntaxError ? 400 : 422
          response.end('Unable to save shorelines')
        }
      })
    },
  }
}

/** Dev-only bridge: credentials never reach browser code or LAN clients. */
function localGuestbookAdmin(): Plugin {
  return {
    name: 'local-guestbook-admin',
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
    navigationSavePlugin(),
    sceneDocumentSavePlugin('shorelines', parseShorelines),
    sceneDocumentSavePlugin('ambience', parseAmbientZones),
  ],
  // Saving editor documents should not reload the world mid-edit.
  server: {
    proxy: {
      '/api/guestbook': { target: 'http://127.0.0.1:8791' },
      '/parties': { target: 'http://127.0.0.1:8791', ws: true },
    },
    watch: {
      ignored: [
        '**/public/ambience/archipelago.json',
        '**/public/shorelines/archipelago.json',
        '**/public/navigation/archipelago.json',
      ],
    },
  },
  base: './',
})
