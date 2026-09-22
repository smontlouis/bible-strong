import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./catalogue', () => ({ GAME_CATALOGUE_NAME: 'test-catalogue' }))
vi.mock('./ai', () => ({ judgeAnswer: vi.fn() }))
import { WorldGames } from './room'
import { judgeAnswer } from './ai'
import { CatalogueStore, type CatalogueRequest } from './catalogue-store'
import { questionSeed, identitySeed, catalogueRevision } from './catalogue-seed.generated'
import { sqliteStorage } from './sqlite-test'
import type { GamesSnapshot } from '../../src/games-protocol'
import type { Round } from './engine'

let database: ReturnType<typeof sqliteStorage>, catalogue: ReturnType<typeof sqliteStorage>
let service: WorldGames, snapshot: GamesSnapshot, allocated: Round[], tasks: Promise<unknown>[]
let allocate: ReturnType<typeof vi.fn<(request: CatalogueRequest) => Promise<Round[]>>>
beforeEach(() => {
  vi.clearAllMocks()
  database = sqliteStorage()
  catalogue = sqliteStorage()
  const store = new CatalogueStore(catalogue.storage)
  store.seed(catalogueRevision, questionSeed, identitySeed)
  tasks = []
  allocated = []
  allocate = vi.fn(async request => (allocated = store.select(request)))
  const ctx = {
    storage: { ...database.storage, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (task: Promise<unknown>) => tasks.push(task),
  }
  service = new WorldGames(
    ctx as unknown as DurableObjectState,
    { GameCatalogue: { getByName: () => ({ allocate }) } } as never,
    () => [
      {
        id: 'avatar',
        historyId: 'history',
        profile: { name: 'Visitor', avatar: 'nova', color: '#73cdd0' },
        x: 836,
        y: 500,
        present: true,
      },
    ],
    (_id, value) => (snapshot = value)
  )
  service.command('avatar', {
    action: 'create',
    options: {
      kind: 'quiz',
      mode: 'solo',
      difficulty: 'easy',
      subject: 'mixed',
      testament: 'both',
      language: 'fr',
    },
  })
})
afterEach(() => {
  database.db.close()
  catalogue.db.close()
})
async function settle() {
  while (tasks.length) await Promise.all(tasks.splice(0))
}
it('loads from SQLite and scores an exact answer without any evaluator call', async () => {
  service.command('avatar', { action: 'start' })
  await settle()
  expect(allocate.mock.calls[0][0].players).toEqual(['history'])
  expect(snapshot.game?.question).toBe(allocated[0].question)
  expect(snapshot.game?.choices).toBeUndefined()
  expect(snapshot.game?.result).toBeUndefined()
  expect(JSON.stringify(snapshot)).not.toContain('catalogueId')
  const game = snapshot.game!
  service.command('avatar', {
    action: 'answer',
    gameId: game.id,
    round: 0,
    text: allocated[0].answer,
  })
  await settle()
  expect(judgeAnswer).not.toHaveBeenCalled()
  expect(snapshot.game?.solo?.streak).toBe(1)
  expect(snapshot.game?.result).toBeUndefined()
  expect(snapshot.game?.soloReview).toBeUndefined()
  expect(snapshot.game?.question).toBe(allocated[1].question)
  expect(snapshot.game?.solo?.pauses).toEqual([])
  expect(allocate.mock.calls[0][0].count).toBe(50)
})
it('sends only unmatched answers to Jev and preserves the question/timer on an outage', async () => {
  service.command('avatar', { action: 'start' })
  await settle()
  vi.mocked(judgeAnswer).mockResolvedValue('unavailable')
  const game = snapshot.game!
  service.command('avatar', {
    action: 'answer',
    gameId: game.id,
    round: 0,
    text: 'An uncertain misspelling',
  })
  await settle()
  expect(judgeAnswer).toHaveBeenCalledTimes(1)
  expect(judgeAnswer).toHaveBeenCalledWith(
    allocated[0],
    'An uncertain misspelling',
    expect.anything()
  )
  expect(snapshot.game?.phase).toBe('question')
  expect(snapshot.game?.question).toBe(game.question)
  expect(snapshot.game?.solo?.streak).toBe(0)
  expect(snapshot.game?.solo?.pauses).toContain('technical')
  expect(snapshot.game?.ownAnswer?.status).toBe('unavailable')
  service.command('avatar', { action: 'next' })
  service.command('avatar', {
    action: 'answer',
    gameId: game.id,
    round: 0,
    text: allocated[0].answer,
  })
  await settle()
  expect(judgeAnswer).toHaveBeenCalledTimes(1)
  expect(snapshot.game?.solo?.streak).toBe(1)
})
it('returns a retryable paused lobby on SQLite failure and recovers without generation', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  allocate.mockRejectedValueOnce(new Error('Database unavailable'))
  service.command('avatar', { action: 'start' })
  await settle()
  expect(snapshot.game?.phase).toBe('lobby')
  expect(snapshot.game?.reason).toBe('generation_failed')
  expect(snapshot.game?.solo?.remainingMs).toBe(120_000)
  service.command('avatar', { action: 'start' })
  await settle()
  expect(snapshot.game?.phase).toBe('question')
  expect(judgeAnswer).not.toHaveBeenCalled()
  warning.mockRestore()
})
it('does not restore an abandoned game when a delayed allocation completes', async () => {
  let resolve!: (rounds: Round[]) => void
  const original = allocate.getMockImplementation()!
  allocate.mockImplementationOnce(
    request =>
      new Promise(done => {
        resolve = done
        void original(request)
      })
  )
  service.command('avatar', { action: 'start' })
  service.command('avatar', { action: 'leave' })
  resolve(allocated)
  await settle()
  expect(snapshot.game).toBeNull()
})
