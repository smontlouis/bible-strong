import { DurableObject } from 'cloudflare:workers'
import { parseSubmission, type GuestbookEntry } from '../src/guestbook'
import { moderateGuestbook, GUESTBOOK_POLICY_VERSION } from './guestbook-moderation'

export interface GuestbookEnv {
  Guestbook: DurableObjectNamespace<Guestbook>
  AI_GATEWAY_API_KEY?: string
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export class Guestbook extends DurableObject<GuestbookEnv> {
  private pending = new Map<string, Promise<Response>>()
  constructor(ctx: DurableObjectState, env: GuestbookEnv) {
    super(ctx, env)
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS entries (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, policy TEXT NOT NULL)`
    )
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS attempts (client TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)`
    )
  }
  async fetch(request: Request): Promise<Response> {
    const sql = this.ctx.storage.sql
    if (request.method === 'GET') {
      const raw = new URL(request.url).searchParams.get('cursor')
      const cursor = raw === null ? Number.MAX_SAFE_INTEGER : Number(raw)
      if (!Number.isSafeInteger(cursor) || cursor < 1) return json({ error: 'invalid' }, 400)
      const rows = sql
        .exec<{
          seq: number
          payload: string
        }>('SELECT seq, payload FROM entries WHERE seq < ? ORDER BY seq DESC LIMIT 21', cursor)
        .toArray()
      return json({
        entries: rows.slice(0, 20).map(row => JSON.parse(row.payload)),
        cursor: rows.length > 20 ? rows[19].seq : null,
      })
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    let submission
    try {
      submission = parseSubmission(await request.json())
    } catch {
      return json({ error: 'invalid' }, 400)
    }
    if (!submission) return json({ error: 'invalid' }, 400)
    const existing = sql
      .exec<{ payload: string }>('SELECT payload FROM entries WHERE id = ?', submission.id)
      .toArray()[0]
    if (existing) {
      const entry = JSON.parse(existing.payload) as GuestbookEntry
      if (
        entry.message !== submission.message ||
        JSON.stringify(entry.profile) !== JSON.stringify(submission.profile)
      )
        return json({ error: 'conflict' }, 409)
      return json({ entry })
    }
    const active = this.pending.get(submission.id)
    if (active) return json({ error: 'retry' }, 409)
    const window = Math.floor(Date.now() / 60_000)
    sql.exec('DELETE FROM attempts WHERE window < ?', window)
    for (const [client, limit] of [
      [request.headers.get('X-Guestbook-Client') || 'unknown', 20],
      ['global', 120],
    ] as const) {
      sql.exec(
        'INSERT INTO attempts (client, window, count) VALUES (?, ?, 1) ON CONFLICT(client) DO UPDATE SET count = count + 1',
        client,
        window
      )
      if (
        sql.exec<{ count: number }>('SELECT count FROM attempts WHERE client = ?', client).one()
          .count > limit
      )
        return json({ error: 'rate_limited' }, 429)
    }
    const operation = (async () => {
      const result = await moderateGuestbook(submission, this.env.AI_GATEWAY_API_KEY)
      if (result !== 'accepted') return json({ error: result }, result === 'rejected' ? 422 : 503)
      const entry: GuestbookEntry = { ...submission, createdAt: Date.now() }
      sql.exec(
        'INSERT INTO entries (id, payload, policy) VALUES (?, ?, ?)',
        entry.id,
        JSON.stringify(entry),
        GUESTBOOK_POLICY_VERSION
      )
      return json({ entry }, 201)
    })()
    this.pending.set(submission.id, operation)
    try {
      return await operation
    } finally {
      this.pending.delete(submission.id)
    }
  }
}

export async function routeGuestbook(request: Request, env: GuestbookEnv): Promise<Response> {
  // Bound the body before parsing or invoking the paid provider.
  if (request.method === 'POST') {
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'invalid' }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        return json({ error: 'invalid' }, 413)
      }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.length
    }
    const address = request.headers.get('CF-Connecting-IP') || 'local'
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${Math.floor(Date.now() / 60_000)}:${address}`)
    )
    const client = Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    request = new Request(request.url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', 'X-Guestbook-Client': client },
    })
  }
  return env.Guestbook.get(env.Guestbook.idFromName('asi-europe')).fetch(request)
}
