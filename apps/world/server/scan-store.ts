// The storage and the admin page of stand scans (see scans.ts), apart from the Durable Object so
// they can be tested on real SQLite outside workerd.
import type { GuestbookSql } from './guestbook-store'

/** Days and hours are the stand's, in France. */
const TIME_ZONE = 'Europe/Paris'

export type ScanCount = { source: string; day: string; hour?: number; scans: number; visitors: number }
export type ScanStats = { days: ScanCount[]; hours: ScanCount[] }

const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})
/** The day (YYYY-MM-DD) and the hour of a moment, in France. */
export function scanTime(at: number) {
  const part = Object.fromEntries(clock.formatToParts(at).map(({ type, value }) => [type, value]))
  return { day: `${part.year}-${part.month}-${part.day}`, hour: Number(part.hour) }
}
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')

export class ScanStore {
  constructor(private sql: GuestbookSql) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS scans (at INTEGER NOT NULL, day TEXT NOT NULL, hour INTEGER NOT NULL, source TEXT NOT NULL, visitor TEXT NOT NULL)'
    )
    sql.exec('CREATE INDEX IF NOT EXISTS scans_by_day ON scans(day, hour)')
    sql.exec('CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL)')
  }
  async record(source: string, client: string, at: number) {
    const { day, hour } = scanTime(at)
    // The salt is settled before any await, so two scans of the same day share it.
    this.sql.exec('DELETE FROM salts WHERE day <> ?', day)
    this.sql.exec(
      'INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)',
      day,
      hex(crypto.getRandomValues(new Uint8Array(16)))
    )
    const { salt } = this.sql.exec<{ salt: string }>('SELECT salt FROM salts WHERE day = ?', day).one()
    const visitor = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt} ${client}`)))
    this.sql.exec(
      'INSERT INTO scans (at, day, hour, source, visitor) VALUES (?, ?, ?, ?, ?)',
      at,
      day,
      hour,
      source,
      visitor
    )
  }
  stats(): ScanStats {
    const days = this.sql
      .exec<ScanCount>(
        'SELECT source, day, COUNT(*) AS scans, COUNT(DISTINCT visitor) AS visitors FROM scans GROUP BY source, day ORDER BY day DESC, source'
      )
      .toArray()
    const hours = this.sql
      .exec<ScanCount & { hour: number }>(
        'SELECT source, day, hour, COUNT(*) AS scans, COUNT(DISTINCT visitor) AS visitors FROM scans GROUP BY source, day, hour ORDER BY day DESC, hour DESC, source'
      )
      .toArray()
    return { days, hours }
  }
}

const escape = (text: string | number) =>
  String(text).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
const table = (head: string[], rows: (string | number)[][]) =>
  `<table><thead><tr>${head.map(cell => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${
    rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${head.length}">Aucun scan pour l’instant.</td></tr>`
  }</tbody></table>`

/** The admin page: today first, then every day; it refreshes itself every minute. */
export function scanReport(stats: ScanStats, now: number) {
  const today = scanTime(now).day
  const todays = stats.days.filter(count => count.day === today)
  const total = (key: 'scans' | 'visitors', counts: ScanCount[]) =>
    counts.reduce((sum, count) => sum + count[key], 0)
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<meta name="robots" content="noindex">
<title>Scans du stand</title>
<style>
:root { color-scheme: light dark; --ink: #101b35; --muted: #58657a; --line: #dfe4ef; --canvas: #f4f7ff; --surface: #fff; --brand: #5983f0; }
@media (prefers-color-scheme: dark) { :root { --ink: #eef2fb; --muted: #a3adc2; --line: #2a3550; --canvas: #0d1424; --surface: #151f35; } }
body { margin: 0; padding: 24px 16px 48px; background: var(--canvas); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 28px; }
h2 { margin: 32px 0 10px; font-size: 18px; }
p { margin: 0; color: var(--muted); }
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.tile { padding: 16px 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
.tile strong { display: block; font-size: 40px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tile span { color: var(--muted); }
table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
th { color: var(--muted); font-weight: 600; font-size: 14px; }
tr:last-child td { border-bottom: 0; }
</style>
</head>
<body>
<main>
<h1>Scans du stand</h1>
<p>Une personne compte une fois par jour. Heure de Paris, mise à jour chaque minute.</p>
<div class="tiles">
<div class="tile"><strong>${total('scans', todays)}</strong><span>scans aujourd’hui</span></div>
<div class="tile"><strong>${total('visitors', todays)}</strong><span>personnes aujourd’hui</span></div>
</div>
<h2>Aujourd’hui, heure par heure</h2>
${table(
  ['Heure', 'Lieu', 'Scans', 'Personnes'],
  stats.hours
    .filter(count => count.day === today)
    .map(count => [`${count.hour}h`, count.source, count.scans, count.visitors])
)}
<h2>Par jour</h2>
${table(
  ['Jour', 'Lieu', 'Scans', 'Personnes'],
  stats.days.map(count => [count.day, count.source, count.scans, count.visitors])
)}
</main>
</body>
</html>`
}
