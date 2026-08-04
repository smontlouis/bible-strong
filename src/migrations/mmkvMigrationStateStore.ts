import { storage } from '~helpers/storage'

import {
  MigrationExecutionError,
  type MigrationStateStore,
  type PersistedMigrationState,
} from './appMigrationOrchestrator'

export const APP_MIGRATION_STATE_KEY = 'app_migration_state_v1'

interface MigrationStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
}

const activeLocks = new WeakMap<MigrationStorage, Set<string>>()

export const createMmkvMigrationStateStore = ({
  storage: backend = storage,
  key = APP_MIGRATION_STATE_KEY,
}: {
  storage?: MigrationStorage
  key?: string
} = {}): MigrationStateStore => ({
  async load() {
    const serialized = backend.getString(key)
    if (typeof serialized === 'undefined') return null

    try {
      return JSON.parse(serialized) as unknown
    } catch {
      throw new MigrationExecutionError('APP_MIGRATION_STATE_CORRUPT')
    }
  },
  async save(state: PersistedMigrationState) {
    backend.set(key, JSON.stringify(state))
  },
  async runExclusive(operation) {
    const locks = activeLocks.get(backend) ?? new Set<string>()
    activeLocks.set(backend, locks)
    if (locks.has(key)) {
      throw new MigrationExecutionError('APP_MIGRATION_RUNNER_BUSY')
    }

    locks.add(key)
    try {
      return await operation()
    } finally {
      locks.delete(key)
    }
  },
})
