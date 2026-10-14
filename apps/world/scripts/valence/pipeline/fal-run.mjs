// Generic fal queue runner: node fal-run.mjs <endpoint> <input.json> <outdir> [submit|collect|run]
import { fal } from '@fal-ai/client'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, basename } from 'node:path'
process.loadEnvFile(resolve(import.meta.dirname, '../../../../../.env'))
const [endpoint, inputPath, outDir, action = 'run'] = process.argv.slice(2)
await mkdir(outDir, { recursive: true })
const reqPath = resolve(outDir, 'request.json')
async function uploadIfLocal(value) {
  if (typeof value === 'string' && value.startsWith('file:')) {
    const p = value.slice(5)
    const buf = await readFile(p)
    const type = p.endsWith('.png') ? 'image/png' : p.endsWith('.mp4') ? 'video/mp4' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    return fal.storage.upload(new File([buf], basename(p), { type }))
  }
  if (Array.isArray(value)) return Promise.all(value.map(uploadIfLocal))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = await uploadIfLocal(v)
    return out
  }
  return value
}
async function download(result) {
  await writeFile(resolve(outDir, 'result.json'), JSON.stringify(result, null, 2))
  const urls = []
  const walk = v => {
    if (v && typeof v === 'object') {
      if (typeof v.url === 'string') urls.push(v.url)
      for (const x of Object.values(v)) walk(x)
    }
  }
  walk(result.data)
  let i = 0
  for (const url of urls) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
    const ext = (url.split('?')[0].match(/\.(\w+)$/) || [, 'bin'])[1]
    const file = resolve(outDir, `output-${i++}.${ext}`)
    await writeFile(file, Buffer.from(await r.arrayBuffer()))
    console.log('saved', file)
  }
}
if (action === 'submit' || action === 'run') {
  if (existsSync(reqPath)) console.log('already submitted')
  else {
    const input = await uploadIfLocal(JSON.parse(await readFile(inputPath, 'utf8')))
    const request = await fal.queue.submit(endpoint, { input })
    await writeFile(reqPath, JSON.stringify({ endpoint, ...request }, null, 2))
    console.log('submitted', request.request_id)
  }
}
if (action === 'collect' || action === 'run') {
  const { request_id } = JSON.parse(await readFile(reqPath, 'utf8'))
  for (;;) {
    const status = await fal.queue.status(endpoint, { requestId: request_id, logs: false })
    if (status.status === 'COMPLETED') break
    if (action === 'collect') { console.log(status.status); process.exit(0) }
    await new Promise(r => setTimeout(r, 5000))
  }
  try {
    const result = await fal.queue.result(endpoint, { requestId: request_id })
    await download(result)
  } catch (e) {
    console.error('FAILED', e.message, JSON.stringify(e.body ?? '').slice(0, 800))
    process.exitCode = 1
  }
}
