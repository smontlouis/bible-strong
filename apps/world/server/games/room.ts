import type { GameAction, GameError, GamesSnapshot } from '../../src/games-protocol'
import {
  emptyGames,
  GameEngine,
  GameFault,
  type Effect,
  type GameData,
  type Visitor,
} from './engine'
import { generateRounds, judgeAnswer, type GameAIEnv } from './ai'

/** One bounded game collection per event room, persisted in that room's SQLite store.
 * No network await inside a state transition. AI completions recheck operation IDs. */
export class WorldGames {
  constructor(
    private ctx: DurableObjectState,
    private env: GameAIEnv,
    private visitors: () => Visitor[],
    private deliver: (id: string, snapshot: GamesSnapshot, error?: GameError) => void
  ) {
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS world_games (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)'
    )
  }
  private read() {
    const row = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM world_games WHERE id = 1')
      .toArray()[0]
    return new GameEngine(row ? (JSON.parse(row.payload) as GameData) : emptyGames(), this.visitors)
  }
  private save(engine: GameEngine) {
    this.ctx.storage.sql.exec(
      'INSERT INTO world_games (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      JSON.stringify(engine.data)
    )
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
      const rounds = await generateRounds(effect.options, this.env)
      const engine = this.read()
      engine.tick()
      engine.generated(effect, rounds)
      this.save(engine)
    } else {
      const result = await judgeAnswer(effect.content, effect.text, this.env)
      const engine = this.read()
      engine.tick()
      engine.evaluated(effect, result)
      this.save(engine)
    }
  }
}
