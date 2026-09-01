#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sharedPresentationPath = path.resolve(root, '../../src/commentaryPresentation.ts')
const egwExportRoot = path.join(root, '.local/egw-export')
const port = Number(process.env.COMMENTARY_READER_PORT ?? 4177)
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' }

let egwParagraphsPromise = null
const loadEgwParagraphs = () => {
  if (!egwParagraphsPromise) {
    egwParagraphsPromise = (async () => {
      const manifest = JSON.parse(await readFile(path.join(egwExportRoot, 'manifest.json'), 'utf8'))
      const artifact = manifest.artifacts?.indexedParagraphs
      if (!artifact) throw new Error('Artefact des paragraphes EGW absent')
      const raw = await readFile(path.join(egwExportRoot, artifact.path), 'utf8')
      const sha256 = createHash('sha256').update(raw).digest('hex')
      if (sha256 !== artifact.sha256) throw new Error('Hash des paragraphes EGW invalide')
      const paragraphs = JSON.parse(raw)
      return new Map(paragraphs.map(paragraph => [paragraph.id, paragraph]))
    })().catch(error => {
      egwParagraphsPromise = null
      throw error
    })
  }
  return egwParagraphsPromise
}

const sendJson = (response, status, value) => {
  response.writeHead(status, { 'Content-Type': mimeTypes['.json'], 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`)
    const pathname = decodeURIComponent(requestUrl.pathname)
    if (pathname === '/api/egw-paragraphs') {
      const ids = [...new Set(requestUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [])]
      if (ids.length === 0 || ids.length > 200 || ids.some(id => !/^\d+\.\d+$/.test(id))) {
        sendJson(response, 400, { error: 'Identifiants EGW invalides' })
        return
      }
      const paragraphsById = await loadEgwParagraphs()
      sendJson(response, 200, {
        paragraphs: ids.map(id => paragraphsById.get(id)).filter(Boolean),
        missingIds: ids.filter(id => !paragraphsById.has(id)),
      })
      return
    }
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const filePath = relativePath === 'shared/commentaryPresentation.js'
      ? sharedPresentationPath
      : path.resolve(root, relativePath)
    if (filePath !== sharedPresentationPath && !filePath.startsWith(`${root}${path.sep}`)) throw new Error('Chemin refusé')
    const details = await stat(filePath)
    if (!details.isFile()) throw new Error('Introuvable')
    const contentType = filePath === sharedPresentationPath
      ? mimeTypes['.js']
      : mimeTypes[path.extname(filePath)] ?? 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
    createReadStream(filePath).pipe(response)
  } catch (error) {
    if (request.url?.startsWith('/api/')) {
      sendJson(response, 500, { error: error.message })
      return
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Introuvable')
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Cabinet des commentaires : http://127.0.0.1:${port}\n`)
})
