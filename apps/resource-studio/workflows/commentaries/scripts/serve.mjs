#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.COMMENTARY_READER_PORT ?? 4177)
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' }

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname)
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const filePath = path.resolve(root, relativePath)
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Chemin refusé')
    const details = await stat(filePath)
    if (!details.isFile()) throw new Error('Introuvable')
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Introuvable')
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Cabinet des commentaires : http://127.0.0.1:${port}\n`)
})
