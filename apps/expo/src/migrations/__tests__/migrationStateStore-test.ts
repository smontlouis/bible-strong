/* eslint-disable import/first */

jest.mock('~helpers/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}))

import { createMmkvMigrationStateStore } from '../mmkvMigrationStateStore'
import type { PersistedMigrationState } from '../appMigrationOrchestrator'

const state: PersistedMigrationState = {
  schemaVersion: 1,
  executions: [],
}

describe('mmkvMigrationStateStore', () => {
  it('round-trips schema-versioned orchestrator state', async () => {
    const values = new Map<string, string>()
    const store = createMmkvMigrationStateStore({
      storage: {
        getString: key => values.get(key),
        set: (key, value) => values.set(key, value),
      },
    })

    await expect(store.load()).resolves.toBeNull()
    await store.save(state)
    await expect(store.load()).resolves.toEqual(state)
    expect(store.loadSync!()).toEqual(state)
  })

  it('fails closed when the persisted JSON is corrupt', async () => {
    const store = createMmkvMigrationStateStore({
      storage: {
        getString: () => '{broken',
        set: jest.fn(),
      },
    })

    await expect(store.load()).rejects.toThrow('APP_MIGRATION_STATE_CORRUPT')
  })

  it('treats an empty persisted value as corrupt rather than absent', async () => {
    const store = createMmkvMigrationStateStore({
      storage: {
        getString: () => '',
        set: jest.fn(),
      },
    })

    await expect(store.load()).rejects.toThrow('APP_MIGRATION_STATE_CORRUPT')
  })

  it('shares one runner lock across adapters backed by the same MMKV key', async () => {
    const backend = {
      getString: jest.fn(() => undefined),
      set: jest.fn(),
    }
    const firstStore = createMmkvMigrationStateStore({ storage: backend })
    const secondStore = createMmkvMigrationStateStore({ storage: backend })
    let release = () => {}
    let notifyStarted = () => {}
    const started = new Promise<void>(resolve => {
      notifyStarted = resolve
    })
    const waitForRelease = new Promise<void>(resolve => {
      release = resolve
    })

    const firstOperation = firstStore.runExclusive(async () => {
      notifyStarted()
      await waitForRelease
    })
    await started
    await expect(secondStore.runExclusive(async () => {})).rejects.toThrow(
      'APP_MIGRATION_RUNNER_BUSY'
    )
    release()
    await firstOperation
  })
})
