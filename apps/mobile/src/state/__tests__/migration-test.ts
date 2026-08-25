import {
  isAccountMigrationWriteAllowedFor,
  isAccountMigrationOutgoingOnlyFor,
  isMigrationInProgress,
  setAccountMigrationInProgress,
  setAccountMigrationWriteScope,
} from '../migration'

describe('account migration state', () => {
  afterEach(() => {
    setAccountMigrationInProgress(false)
    setAccountMigrationWriteScope()
  })

  it('opens outgoing synchronization only for the inspected UID', () => {
    setAccountMigrationWriteScope('user-a')

    expect(isAccountMigrationWriteAllowedFor('user-a')).toBe(true)
    expect(isAccountMigrationWriteAllowedFor('user-b')).toBe(false)
    expect(isAccountMigrationOutgoingOnlyFor('user-a')).toBe(false)

    setAccountMigrationWriteScope('user-a', 'outgoing-only')
    expect(isAccountMigrationOutgoingOnlyFor('user-a')).toBe(true)

    setAccountMigrationWriteScope()
    expect(isAccountMigrationWriteAllowedFor('user-a')).toBe(false)
  })

  it('includes the account phase in the shared migration barrier', () => {
    setAccountMigrationInProgress(true)
    expect(isMigrationInProgress()).toBe(true)

    setAccountMigrationInProgress(false)
    expect(isMigrationInProgress()).toBe(false)
  })
})
