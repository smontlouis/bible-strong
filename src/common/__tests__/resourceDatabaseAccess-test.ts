/* eslint-disable import/first */
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock('~helpers/databases', () => ({
  getDbPath: jest.fn(),
}))
jest.mock('~helpers/firebase', () => ({
  getDatabaseUrl: jest.fn(),
}))
jest.mock('~helpers/sqlite', () => ({
  dbManager: {
    getDB: jest.fn(),
  },
  initSQLiteDirForLang: jest.fn(),
}))
jest.mock('~helpers/toast', () => ({
  toast: {
    error: jest.fn(),
  },
}))

import { getResourceDatabaseProgress } from '../resourceDatabaseAccess'

describe('resourceDatabaseAccess', () => {
  it('normalizes download progress with two decimal precision', () => {
    expect(getResourceDatabaseProgress(0, 1000)).toBe(0)
    expect(getResourceDatabaseProgress(499, 1000)).toBe(0.49)
    expect(getResourceDatabaseProgress(500, 1000)).toBe(0.5)
    expect(getResourceDatabaseProgress(1000, 1000)).toBe(1)
  })
})
