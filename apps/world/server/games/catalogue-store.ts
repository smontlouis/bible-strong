import type { CatalogueIdentity, CatalogueQuestion } from '../../src/game-catalogue'
import { referenceLabel } from '../../src/game-catalogue'
import type { GameOptions } from '../../src/games-protocol'
import type { Round } from './engine'

export type CatalogueRequest = {
  operation: string
  options: GameOptions
  players: string[]
  exclude: string[]
  count: number
}
type Row = { id: string; kind: string; payload: string }
type Storage = Pick<DurableObjectStorage, 'sql' | 'transactionSync'>

/** Catalogue allocation is atomic: concurrent rooms cannot reserve the same unseen
 * question for a shared visitor. A reservation counts as offered, including the
 * rest of a batch if the player leaves before finishing it. */
export class CatalogueStore {
  constructor(private storage: Storage) {
    storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS catalogue_meta (id INTEGER PRIMARY KEY CHECK(id = 1), revision TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS catalogue_questions (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, difficulty TEXT, testament TEXT NOT NULL, payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS catalogue_filter ON catalogue_questions(kind, testament, difficulty);
      CREATE TABLE IF NOT EXISTS catalogue_history (
        player TEXT NOT NULL, question TEXT NOT NULL, last_seen INTEGER NOT NULL, times_seen INTEGER NOT NULL,
        PRIMARY KEY(player, question)
      );
      CREATE TABLE IF NOT EXISTS catalogue_allocations (
        operation TEXT PRIMARY KEY, request TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS catalogue_allocation_age ON catalogue_allocations(created_at);
    `)
  }
  seed(revision: string, questions: CatalogueQuestion[], identities: CatalogueIdentity[]) {
    const sql = this.storage.sql
    if (
      sql
        .exec<{ revision: string }>('SELECT revision FROM catalogue_meta WHERE id = 1')
        .toArray()[0]?.revision === revision
    )
      return
    this.storage.transactionSync(() => {
      // Reconcile content atomically, retaining stable history and active allocations.
      sql.exec('DELETE FROM catalogue_questions')
      for (const q of questions)
        sql.exec(
          'INSERT INTO catalogue_questions VALUES (?, ?, ?, ?, ?)',
          q.id,
          'quiz',
          q.difficulty,
          q.testament,
          JSON.stringify(q)
        )
      for (const q of identities)
        sql.exec(
          'INSERT INTO catalogue_questions VALUES (?, ?, ?, ?, ?)',
          q.id,
          'who',
          null,
          q.testament,
          JSON.stringify(q)
        )
      sql.exec(
        'INSERT INTO catalogue_meta VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision',
        revision
      )
    })
  }
  select(request: CatalogueRequest, now = Date.now()): Round[] {
    if (
      !Number.isInteger(request.count) ||
      request.count < 1 ||
      request.count >
        (request.options.mode === 'solo' && request.options.kind === 'quiz' ? 50 : 5) ||
      !request.operation ||
      request.operation.length > 160 ||
      request.players.length < 1 ||
      request.players.length > 4 ||
      request.players.some(id => !id || id.length > 100) ||
      request.exclude.length > 50
    )
      throw new Error('Invalid catalogue allocation')
    const players = [...new Set(request.players)].sort()
    const exclude = [...new Set(request.exclude)].sort()
    const key = JSON.stringify({ ...request, players, exclude })
    const sql = this.storage.sql
    return this.storage.transactionSync(() => {
      sql.exec('DELETE FROM catalogue_allocations WHERE created_at < ?', now - 48 * 60 * 60_000)
      const prior = sql
        .exec<{
          request: string
          payload: string
        }>(
          'SELECT request, payload FROM catalogue_allocations WHERE operation = ?',
          request.operation
        )
        .toArray()[0]
      if (prior) {
        if (prior.request !== key)
          throw new Error('Catalogue operation reused with different input')
        return JSON.parse(prior.payload) as Round[]
      }
      const rows = sql
        .exec<Row>(
          `
        SELECT q.id, q.kind, q.payload FROM catalogue_questions q
        LEFT JOIN catalogue_history h ON h.question = q.id AND h.player IN (SELECT value FROM json_each(?))
        WHERE q.kind = ? AND (? = 'both' OR q.testament = ?)
          AND (q.kind = 'who' OR q.difficulty = ?)
          AND q.id NOT IN (SELECT value FROM json_each(?))
        GROUP BY q.id
        ORDER BY COUNT(h.player) ASC, COALESCE(MAX(h.last_seen), 0) ASC, RANDOM()
        LIMIT ?`,
          JSON.stringify(players),
          request.options.kind,
          request.options.testament,
          request.options.testament,
          request.options.difficulty,
          JSON.stringify(exclude),
          request.count
        )
        .toArray()
      if (rows.length !== request.count)
        throw new Error('Not enough catalogue questions for this batch')
      const rounds = rows.map(row => toRound(row, request.options))
      for (const row of rows)
        for (const player of players)
          sql.exec(
            `INSERT INTO catalogue_history VALUES (?, ?, ?, 1)
            ON CONFLICT(player, question) DO UPDATE SET last_seen = excluded.last_seen, times_seen = times_seen + 1`,
            player,
            row.id,
            now
          )
      sql.exec(
        'INSERT INTO catalogue_allocations VALUES (?, ?, ?, ?)',
        request.operation,
        key,
        JSON.stringify(rounds),
        now
      )
      return rounds
    })
  }
}

function toRound(row: Row, options: GameOptions): Round {
  const language = options.language
  const other = language === 'fr' ? 'en' : 'fr'
  const entry = JSON.parse(row.payload) as CatalogueQuestion | CatalogueIdentity
  const copy = entry[language]
  // A French game also accepts conventional English names (and conversely).
  const aliases = [...new Set([...copy.aliases, entry[other].answer, ...entry[other].aliases])]
  const sources =
    'clues' in entry
      ? entry.clues.map(clue => ({
          reference: referenceLabel(clue, language),
          url: clue.sourceUrl,
        }))
      : [{ reference: referenceLabel(entry, language), url: entry.sourceUrl }]
  return {
    catalogueId: entry.id,
    question:
      'question' in copy ? copy.question : language === 'fr' ? 'Qui suis-je ?' : 'Who am I?',
    clues: 'clues' in entry ? entry.clues.map(clue => clue[language]) : [],
    choices: [],
    answer: copy.answer,
    aliases,
    explanation: copy.explanation,
    reference: sources
      .map(source => source.reference)
      .filter((value, i, all) => all.indexOf(value) === i)
      .join(' · '),
    url: sources[0].url,
    sources,
    evidence: `${copy.explanation}\n${sources.map(source => source.reference).join('\n')}`,
  }
}
