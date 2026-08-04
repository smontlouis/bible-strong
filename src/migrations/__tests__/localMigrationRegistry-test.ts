/* eslint-disable import/first */

const mockPrepareLegacyStorage = jest.fn(async () => {})
const mockReconcileInstallationJournal = jest.fn(async () => {})

jest.mock('~helpers/storage', () => ({
  prepareLegacyStorageForLocalMigrations: async () => {},
}))

jest.mock('~helpers/resourceInstallationJournal', () => ({
  reconcileResourceInstallationJournal: async () => {},
}))

jest.mock('../appMigrationOrchestrator', () => ({
  createAppMigrationOrchestrator: jest.fn(() => ({ id: 'orchestrator' })),
}))

jest.mock('../mmkvMigrationStateStore', () => ({
  createMmkvMigrationStateStore: jest.fn(() => ({ id: 'store' })),
}))

jest.mock('../legacyResourceMigrationRuntime', () => ({
  legacyResourceMigration: { id: 'legacy-bible-resources' },
}))

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import {
  localMigrationContext,
  localMigrationOrchestrator,
  prepareLocalMigrationInspection,
} from '../localMigrationRegistry'

const mockCreateAppMigrationOrchestrator = jest.mocked(
  jest.requireMock('../appMigrationOrchestrator').createAppMigrationOrchestrator
)
const mockCreateMmkvMigrationStateStore = jest.mocked(
  jest.requireMock('../mmkvMigrationStateStore').createMmkvMigrationStateStore
)
const mockLegacyResourceMigration = jest.requireMock(
  '../legacyResourceMigrationRuntime'
).legacyResourceMigration

describe('localMigrationRegistry', () => {
  it('registers the legacy resource migration in the durable device orchestrator', async () => {
    expect(mockCreateMmkvMigrationStateStore).toHaveBeenCalledTimes(1)
    expect(mockCreateAppMigrationOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        migrations: [mockLegacyResourceMigration],
        store: { id: 'store' },
        onEvent: expect.any(Function),
      })
    )
    expect(localMigrationContext).toEqual({ phase: 'local', scopeId: 'device' })
    expect(localMigrationOrchestrator).toEqual({ id: 'orchestrator' })
    await prepareLocalMigrationInspection({
      prepareStorage: mockPrepareLegacyStorage,
      reconcileInstallationJournal: mockReconcileInstallationJournal,
    })
    expect(mockPrepareLegacyStorage).toHaveBeenCalledTimes(1)
    expect(mockReconcileInstallationJournal).toHaveBeenCalledTimes(1)
  })
})
