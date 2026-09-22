import { GAME_CATALOGUE_NAME, type GameCatalogueEnv } from './catalogue'
import type { GameAction, GameError, GamesSnapshot } from '../../src/games-protocol'
import {
  emptyGames,
  GameEngine,
  GameFault,
  type Effect,
  type GameData,
  type Visitor,
} from './engine'
import { judgeAnswer, type GameAIEnv } from './ai'

/** One bounded game collection per event room, persisted in that room's SQLite store.
 * No network await inside a state transition. AI completions recheck operation IDs. */
export class WorldGames {
  constructor(
    private ctx: DurableObjectState,
    private env: GameAIEnv & GameCatalogueEnv,
    private visitors: () => Visitor[],
    private deliver: (id: string, snapshot: GamesSnapshot, error?: GameError) => void
  ) {
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS world_games (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)'
    )
    // One row per game: a solo run reserves 50 questions, so a single shared row would
    // approach the 2 MB SQLite value limit. Row 1 keeps invitations and rate limits only.
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS world_game_rows (id TEXT PRIMARY KEY, payload TEXT NOT NULL)'
    )
  }
  /** Serialized rows as read, so a save only rewrites the games that changed. */
  private loaded = new WeakMap<GameEngine, Map<string, string>>()
  private read() {
    const meta = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM world_games WHERE id = 1')
      .toArray()[0]
    const shared = meta ? (JSON.parse(meta.payload) as Partial<GameData>) : {}
    const rows = this.ctx.storage.sql
      .exec<{ id: string; payload: string }>('SELECT id, payload FROM world_game_rows')
      .toArray()
    const data: GameData = {
      ...emptyGames(),
      invitations: shared.invitations ?? [],
      limits: shared.limits ?? {},
      // Games of the former single-row format migrate on the next save.
      games: [...(shared.games ?? []), ...rows.map(row => JSON.parse(row.payload))],
    }
    const engine = new GameEngine(data, this.visitors)
    this.loaded.set(engine, new Map(rows.map(row => [row.id, row.payload])))
    return engine
  }
  private save(engine: GameEngine) {
    const { games, invitations, limits } = engine.data
    const before = this.loaded.get(engine) ?? new Map<string, string>()
    this.ctx.storage.sql.exec(
      'INSERT INTO world_games (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      JSON.stringify({ invitations, limits })
    )
    for (const game of games) {
      const payload = JSON.stringify(game)
      if (before.get(game.id) !== payload)
        this.ctx.storage.sql.exec(
          'INSERT INTO world_game_rows (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          game.id,
          payload
        )
      before.delete(game.id)
    }
    for (const id of before.keys())
      this.ctx.storage.sql.exec('DELETE FROM world_game_rows WHERE id = ?', id)
    for (const visitor of this.visitors()) this.deliver(visitor.id, engine.snapshot(visitor.id))
    const next = engine.nextWake()
    if (next !== null) this.ctx.waitUntil(this.schedule(next))
  }
  private async schedule(next: number) {
    const current = await this.ctx.storage.getAlarm()
    if (current === null || current > next) await this.ctx.storage.setAlarm(next)
  }
  command(id: string, action: GameAction) {
    const engine = this.read()
    let effect: Effect | undefined, error: GameError | undefined
    try {
      effect = engine.command(id, action)
    } catch (e) {
      if (e instanceof GameFault) error = e.code
      else throw e
    }
    this.save(engine)
    if (error) this.deliver(id, engine.snapshot(id), error)
    if (effect) this.ctx.waitUntil(this.execute(effect))
  }
  presence(id: string, present: boolean) {
    const engine = this.read()
    engine.tick()
    engine.presence(id, present)
    this.save(engine)
  }
  tick() {
    const engine = this.read()
    engine.tick()
    this.save(engine)
    return engine.nextWake()
  }
  private async execute(effect: Effect) {
    if (effect.type === 'generate') {
      let rounds = null
      try {
        rounds = await this.env.GameCatalogue.getByName(GAME_CATALOGUE_NAME).allocate({
          operation: effect.operation,
          options: effect.options,
          players: effect.players ?? [effect.gameId],
          exclude: effect.exclude ?? [],
          count: effect.count ?? 5,
        })
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: 'game_catalogue_failed',
            gameId: effect.gameId,
            message: error instanceof Error ? error.message : 'Catalogue unavailable',
          })
        )
      }
      const engine = this.read()
      engine.tick()
      engine.generated(effect, rounds)
      this.save(engine)
    } else {
      const result = await judgeAnswer(effect.content, effect.text, this.env)
      const engine = this.read()
      engine.tick()
      const next = engine.evaluated(effect, result)
      this.save(engine)
      if (next) this.ctx.waitUntil(this.execute(next))
    }
  }
}
