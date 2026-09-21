import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GuestbookStore, type GuestbookSql } from '../server/guestbook-store'
import { authenticateAdmin, validAdminMutation } from '../server/guestbook-auth'
import {
  deliverNotification,
  notificationEmail,
  retryDelay,
} from '../server/guestbook-notifications'

const entry = {
  id: '01234567-1234-1234-1234-123456789abc',
  profile: { name: 'Visiteur', avatar: 'nova' as const, color: '#73cdd0' },
  message: 'Merci !',
  createdAt: 1_700_000_000_000,
}
function database() {
  // Python SQLite keeps these real-SQL tests compatible with the Node 20 CI runner.
  const directory = mkdtempSync(join(tmpdir(), 'guestbook-sql-'))
  const db = { close: () => rmSync(directory, { recursive: true, force: true }) }
  const sql: GuestbookSql = {
    exec<T>(query: string, ...bindings: (string | number | null)[]) {
      const rows = JSON.parse(
        execFileSync(
          'python3',
          [
            '-c',
            `
import json, sqlite3, sys
args = json.load(sys.stdin)
with sqlite3.connect(args['path']) as db:
    db.row_factory = sqlite3.Row
    print(json.dumps([dict(row) for row in db.execute(args['query'], args['bindings']).fetchall()]))
`,
          ],
          {
            input: JSON.stringify({ path: join(directory, 'test.sqlite'), query, bindings }),
            encoding: 'utf8',
          }
        )
      ) as T[]
      return {
        toArray: () => rows,
        one: () => {
          if (rows.length !== 1) throw new Error('Expected one row')
          return rows[0]
        },
      }
    },
  }
  sql.exec(
    'CREATE TABLE entries (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, payload TEXT, policy TEXT)'
  )
  sql.exec(
    'INSERT INTO entries (id, payload, policy) VALUES (?, ?, ?)',
    entry.id,
    JSON.stringify(entry),
    'guestbook-2'
  )
  return { db, store: new GuestbookStore(sql), sql }
}
describe('guestbook administration storage', () => {
  it('preserves existing messages, hides them publicly and restores them without data loss', () => {
    const { db, store } = database()
    try {
      expect(store.list(Number.MAX_SAFE_INTEGER).entries).toEqual([entry])
      expect(store.setVisibility(entry.id, true, 'admin@example.com')).toBe(true)
      expect(store.list(Number.MAX_SAFE_INTEGER).entries).toEqual([])
      expect(store.removed(entry.id)).toBe(true)
      expect(store.list(Number.MAX_SAFE_INTEGER, 'removed', true).entries[0]).toMatchObject({
        ...entry,
        removedAt: expect.any(Number),
        notification: 'legacy',
      })
      expect(store.setVisibility(entry.id, false, 'admin@example.com')).toBe(true)
      expect(store.list(Number.MAX_SAFE_INTEGER).entries).toEqual([entry])
      expect(store.setVisibility('missing', true, 'admin@example.com')).toBe(false)
    } finally {
      db.close()
    }
  }, 15_000)
  it('paginates visible rows without omissions when removed rows interrupt the sequence', () => {
    const { db, store, sql } = database()
    try {
      sql.exec(
        "INSERT INTO entries(id,payload,policy) SELECT json_extract(value, '$.id'), value, 'test' FROM json_each(?)",
        JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ ...entry, id: String(i) })))
      )
      store.setVisibility('25', true, 'admin@example.com')
      const first = store.list(Number.MAX_SAFE_INTEGER)
      const next = store.list(first.cursor!)
      expect(first.entries).toHaveLength(20)
      expect(next.entries).toHaveLength(10)
      expect(new Set([...first.entries, ...next.entries].map(row => row.id)).size).toBe(30)
      expect(store.list(Number.MAX_SAFE_INTEGER, 'all', true, '25').entries).toHaveLength(1)
    } finally {
      db.close()
    }
  }, 15_000)
  it('keeps exactly one durable notification per new message, including after storage recreation', () => {
    const { db, store, sql } = database()
    try {
      expect(store.pendingCount()).toBe(0)
      store.enqueue(entry.id)
      store.enqueue(entry.id)
      const restarted = new GuestbookStore(sql)
      expect(restarted.pendingCount()).toBe(1)
      expect(restarted.due()).toHaveLength(1)
      restarted.delivery(entry.id, false, 1, Date.now() + 60_000, 'failed')
      expect(restarted.due()).toHaveLength(0)
      restarted.delivery(entry.id, true, 2, Date.now(), null)
      expect(restarted.pendingCount()).toBe(0)
      expect(restarted.nextAttempt()).toBeNull()
    } finally {
      db.close()
    }
  }, 15_000)
})

describe('notification delivery', () => {
  const settings = {
    GUESTBOOK_NOTIFICATION_TO: 'admin@example.com',
    GUESTBOOK_NOTIFICATION_FROM: 'info@example.com',
    GUESTBOOK_ADMIN_URL: 'https://world.example.com/admin-guestbook',
  }
  it('waits safely for configuration', async () => {
    expect(await deliverNotification(entry, {})).toBe('unconfigured')
    expect(retryDelay(1000)).toBe(3_600_000)
  })
  it('uses a stable idempotency key and a read-only admin link', async () => {
    const mail = notificationEmail(entry, settings)
    expect(mail.to).toBe('admin@example.com')
    expect(mail.text).toContain(`https://world.example.com/admin-guestbook?message=${entry.id}`)
    expect(mail.text).toContain(entry.message)
    let key: string | null = null
    expect(
      await deliverNotification(entry, {
        ...settings,
        GUESTBOOK_MAILER: {
          fetch: async request => {
            key = request.headers.get('Idempotency-Key')
            expect(await request.json()).toEqual(mail)
            return Response.json({ messageId: 'ack-1' })
          },
        },
      })
    ).toBe('sent')
    expect(key).toBe(`guestbook:${entry.id}`)
  })
  it('retries provider errors and malformed acknowledgements', async () => {
    for (const response of [new Response('', { status: 503 }), Response.json({})]) {
      expect(
        await deliverNotification(entry, {
          ...settings,
          GUESTBOOK_MAILER: { fetch: async () => response },
        })
      ).toBe('failed')
    }
  })
})

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
describe('admin authorization', () => {
  it('fails closed and never trusts the email header', async () => {
    const request = new Request('https://world.example.com/api/guestbook/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'admin@example.com',
        Authorization: 'Bearer local-secret',
      },
    })
    expect(
      await authenticateAdmin(request, {
        GUESTBOOK_ADMIN_EMAIL: 'admin@example.com',
        GUESTBOOK_LOCAL_ADMIN_TOKEN: 'local-secret',
      })
    ).toBeNull()
    expect(
      await authenticateAdmin(
        new Request('http://localhost/api/guestbook/admin', {
          headers: { Authorization: 'Bearer local-secret' },
        }),
        { GUESTBOOK_ADMIN_EMAIL: 'admin@example.com', GUESTBOOK_LOCAL_ADMIN_TOKEN: 'local-secret' }
      )
    ).toBe('admin@example.com')
    expect(validAdminMutation(new Request('http://localhost', { method: 'POST' }))).toBe(false)
  })
  it('checks real RSA signatures, issuer, audience, expiry and administrator identity', async () => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    )
    const jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'test-key' }
    const env = {
      GUESTBOOK_ADMIN_EMAIL: 'admin@example.com',
      ACCESS_TEAM_DOMAIN: 'guestbook-test.cloudflareaccess.com',
      ACCESS_AUD: 'guestbook-admin',
    }
    const claims = {
      type: 'app',
      email: 'admin@example.com',
      aud: ['guestbook-admin'],
      iss: 'https://guestbook-test.cloudflareaccess.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    }
    async function token(overrides = {}, alg = 'RS256') {
      const data = `${encode({ alg, kid: 'test-key' })}.${encode({ ...claims, ...overrides })}`
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        keys.privateKey,
        new TextEncoder().encode(data)
      )
      return `${data}.${Buffer.from(signature).toString('base64url')}`
    }
    const validate = (value: string) =>
      authenticateAdmin(
        new Request('https://world.example.com/api/guestbook/admin', {
          headers: { 'Cf-Access-Jwt-Assertion': value },
        }),
        env,
        async () => Response.json({ keys: [jwk] })
      )
    expect(await validate(await token())).toBe('admin@example.com')
    for (const changes of [
      { email: 'stranger@example.com' },
      { aud: ['wrong-app'] },
      { exp: 0 },
      { iss: 'https://attacker.example' },
      { nbf: Date.now() / 1000 + 300 },
      { type: 'service' },
    ])
      expect(await validate(await token(changes))).toBeNull()
    expect(await validate(await token({}, 'none'))).toBeNull()
    const valid = await token()
    expect(await validate(valid.slice(0, -8) + 'AAAAAAAA')).toBeNull()
  })
})
