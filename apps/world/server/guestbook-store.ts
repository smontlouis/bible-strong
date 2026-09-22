import { placeNote, type NotePlacement } from '../src/guestbook-layout'
import type { GuestbookEntry } from '../src/guestbook'
import type { AdminEntry, AdminFilter } from '../src/guestbook-admin'
// The narrow SQLite interface also allows real SQLite tests outside workerd.
export interface GuestbookSql {
  exec<T extends Record<string, string | number | null>>(
    query: string,
    ...bindings: (string | number | null)[]
  ): { toArray(): T[]; one(): T }
}
export class GuestbookStore {
  constructor(private sql: GuestbookSql) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS entry_visibility (entry_id TEXT PRIMARY KEY, removed_at INTEGER, actor TEXT NOT NULL)'
    )
    sql.exec(
      "CREATE TABLE IF NOT EXISTS notifications (entry_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, last_error TEXT)"
    )
    sql.exec('CREATE INDEX IF NOT EXISTS notification_due ON notifications(state, next_attempt)')
    sql.exec(
      'CREATE TABLE IF NOT EXISTS note_placements (entry_id TEXT PRIMARY KEY, geometry TEXT NOT NULL)'
    )
    const unplaced = sql
      .exec<{
        payload: string
      }>(
        'SELECT payload FROM entries WHERE id NOT IN (SELECT entry_id FROM note_placements) ORDER BY seq ASC'
      )
      .toArray()
    for (const row of unplaced) this.place(JSON.parse(row.payload) as GuestbookEntry)
  }
  place(entry: GuestbookEntry): GuestbookEntry {
    const saved = this.sql
      .exec<{
        geometry: string
      }>('SELECT geometry FROM note_placements WHERE entry_id = ?', entry.id)
      .toArray()[0]
    if (saved) return { ...entry, placement: JSON.parse(saved.geometry) as NotePlacement }
    const existing = this.sql
      .exec<{ geometry: string }>('SELECT geometry FROM note_placements')
      .toArray()
      .map(row => JSON.parse(row.geometry) as NotePlacement)
    const placement = placeNote(entry.id, entry.message, existing)
    this.sql.exec(
      'INSERT INTO note_placements (entry_id, geometry) VALUES (?, ?)',
      entry.id,
      JSON.stringify(placement)
    )
    return { ...entry, placement }
  }
  list(cursor: number, filter: AdminFilter = 'visible', admin = false, id?: string) {
    const clause =
      filter === 'visible'
        ? 'AND v.removed_at IS NULL'
        : filter === 'removed'
          ? 'AND v.removed_at IS NOT NULL'
          : ''
    const rows = this.sql
      .exec<{
        seq: number
        payload: string
        geometry: string | null
        removed_at: number | null
        state: string | null
        attempts: number | null
      }>(
        `SELECT e.seq, e.payload, p.geometry, v.removed_at, n.state, n.attempts FROM entries e LEFT JOIN note_placements p ON p.entry_id = e.id LEFT JOIN entry_visibility v ON v.entry_id = e.id LEFT JOIN notifications n ON n.entry_id = e.id WHERE e.seq < ? ${clause} ${id ? 'AND e.id = ?' : ''} ORDER BY e.seq DESC LIMIT 21`,
        ...[cursor, ...(id ? [id] : [])]
      )
      .toArray()
    return {
      entries: rows.slice(0, 20).map(row => {
        const payload = JSON.parse(row.payload) as GuestbookEntry
        const entry = row.geometry
          ? { ...payload, placement: JSON.parse(row.geometry) as NotePlacement }
          : payload
        return admin
          ? ({
              ...entry,
              removedAt: row.removed_at,
              notification: row.state ?? 'legacy',
              notificationAttempts: row.attempts ?? 0,
            } as AdminEntry)
          : entry
      }),
      cursor: rows.length > 20 ? rows[19].seq : null,
    }
  }
  setVisibility(id: string, removed: boolean, actor: string) {
    if (!this.sql.exec('SELECT id FROM entries WHERE id = ?', id).toArray().length) return false
    this.sql.exec(
      'INSERT INTO entry_visibility (entry_id, removed_at, actor) VALUES (?, ?, ?) ON CONFLICT(entry_id) DO UPDATE SET removed_at = excluded.removed_at, actor = excluded.actor',
      id,
      removed ? Date.now() : null,
      actor
    )
    return true
  }
  removed(id: string) {
    return (
      this.sql
        .exec(
          'SELECT entry_id FROM entry_visibility WHERE entry_id = ? AND removed_at IS NOT NULL',
          id
        )
        .toArray().length > 0
    )
  }
  enqueue(id: string) {
    this.sql.exec(
      'INSERT OR IGNORE INTO notifications (entry_id, next_attempt) VALUES (?, ?)',
      id,
      Date.now()
    )
  }
  pendingCount() {
    return this.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM notifications WHERE state = 'queued'")
      .one().count
  }
  due() {
    return this.sql
      .exec<{
        entry_id: string
        payload: string
        attempts: number
      }>(
        "SELECT n.entry_id, e.payload, n.attempts FROM notifications n JOIN entries e ON e.id = n.entry_id WHERE n.state = 'queued' AND n.next_attempt <= ? ORDER BY n.next_attempt LIMIT 5",
        Date.now()
      )
      .toArray()
  }
  delivery(id: string, sent: boolean, attempts: number, nextAttempt: number, error: string | null) {
    this.sql.exec(
      'UPDATE notifications SET state = ?, attempts = ?, next_attempt = ?, last_error = ? WHERE entry_id = ?',
      sent ? 'sent' : 'queued',
      attempts,
      nextAttempt,
      error,
      id
    )
  }
  nextAttempt() {
    return this.sql
      .exec<{
        next: number | null
      }>("SELECT MIN(next_attempt) AS next FROM notifications WHERE state = 'queued'")
      .one().next
  }
}
