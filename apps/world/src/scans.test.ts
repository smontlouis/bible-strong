import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GuestbookSql } from '../server/guestbook-store'
import { ScanStore, scanReport, scanTime } from '../server/scan-store'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
// Python SQLite, as in the guestbook's storage tests, keeps these real-SQL tests on Node 20.
function database(): GuestbookSql {
  const directory = mkdtempSync(join(tmpdir(), 'scans-sql-'))
  directories.push(directory)
  return {
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
}

const morning = Date.parse('2026-10-17T07:15:00Z') // 9h15 in Valence
describe('stand scans', () => {
  it('counts days and hours in France', () => {
    expect(scanTime(morning)).toEqual({ day: '2026-10-17', hour: 9 })
    expect(scanTime(Date.parse('2026-10-17T22:30:00Z'))).toEqual({ day: '2026-10-18', hour: 0 })
  })

  it('counts every scan and each person once a day, without keeping their address', async () => {
    const sql = database()
    const store = new ScanStore(sql)
    await store.record('/valence-1876', '203.0.113.7 iPhone', morning)
    await store.record('/valence-1876', '203.0.113.7 iPhone', morning + 60_000)
    await store.record('/valence-1876', '198.51.100.2 Android', morning + 3_600_000)
    expect(store.stats().days).toEqual([{ source: '/valence-1876', day: '2026-10-17', scans: 3, visitors: 2 }])
    expect(store.stats().hours).toEqual([
      { source: '/valence-1876', day: '2026-10-17', hour: 10, scans: 1, visitors: 1 },
      { source: '/valence-1876', day: '2026-10-17', hour: 9, scans: 2, visitors: 1 },
    ])
    const stored = JSON.stringify(sql.exec('SELECT * FROM scans').toArray())
    expect(stored).not.toContain('203.0.113.7')
    expect(stored).not.toContain('iPhone')
  })

  it('forgets the salt of a past day, so a person is not followed across days', async () => {
    const sql = database()
    const store = new ScanStore(sql)
    await store.record('/valence-1876', '203.0.113.7 iPhone', morning)
    await store.record('/valence-1876', '203.0.113.7 iPhone', morning + 86_400_000)
    expect(sql.exec<{ day: string }>('SELECT day FROM salts').toArray()).toEqual([{ day: '2026-10-18' }])
    const visitors = sql.exec<{ visitor: string }>('SELECT visitor FROM scans').toArray()
    expect(visitors[0].visitor).not.toBe(visitors[1].visitor)
  })

  it('reports today first and escapes what it shows', () => {
    const page = scanReport(
      {
        days: [{ source: '<b>', day: '2026-10-17', scans: 3, visitors: 2 }],
        hours: [{ source: '<b>', day: '2026-10-17', hour: 9, scans: 3, visitors: 2 }],
      },
      morning
    )
    expect(page).toContain('<strong>3</strong><span>scans aujourd’hui</span>')
    expect(page).toContain('<strong>2</strong><span>personnes aujourd’hui</span>')
    expect(page).toContain('<td>9h</td>')
    expect(page).not.toContain('<td><b></td>')
    expect(page).toContain('&#60;b&#62;')
  })
})
