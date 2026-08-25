import {
  AccountEntryAttemptCoordinator,
  canStartRemoteHydration,
  classifyAccountEntry,
  createUnresolvedAccountEntryRepository,
  createAccountEntryState,
  preserveUnresolvedAccountEntryClassification,
  reduceAccountEntry,
} from '~helpers/accountEntry'

class MemoryClassificationStorage {
  value?: string

  getString() {
    return this.value
  }

  set(_key: string, value: string) {
    this.value = value
  }

  remove() {
    this.value = undefined
  }
}

describe('account-entry classification', () => {
  it.each([
    [{ operation: 'email-registration' }, 'new-account'],
    [{ operation: 'email-login' }, 'existing-account'],
    [{ operation: 'provider-link' }, 'provider-link'],
    [{ operation: 'restore-session' }, 'restore-session'],
    [{ operation: 'provider-sign-in', credentialIsNewUser: true }, 'new-account'],
    [{ operation: 'provider-sign-in', credentialIsNewUser: false }, 'existing-account'],
  ] as const)('classifies %o as %s', (input, expected) => {
    expect(classifyAccountEntry(input)).toBe(expected)
  })

  it('keeps provider authentication unknown when credential metadata is unavailable', () => {
    expect(classifyAccountEntry({ operation: 'provider-sign-in' })).toBe('unknown')
  })

  it.each([
    { operation: 'email-registration', credentialIsNewUser: false },
    { operation: 'email-login', credentialIsNewUser: true },
    { operation: 'provider-link', credentialIsNewUser: true },
    { operation: 'restore-session', credentialIsNewUser: false },
    { operation: 'restore-session', credentialIsNewUser: true },
  ] as const)('keeps contradictory metadata unknown for %o', input => {
    expect(classifyAccountEntry(input)).toBe('unknown')
  })

  it('keeps an unresolved classification gated across process restart', () => {
    const storage = new MemoryClassificationStorage()
    let repository = createUnresolvedAccountEntryRepository(storage)

    expect(
      preserveUnresolvedAccountEntryClassification({
        classification: 'unknown',
        userId: 'unresolved-user',
        repository,
      })
    ).toBe('unknown')

    repository = createUnresolvedAccountEntryRepository(storage)
    expect(
      preserveUnresolvedAccountEntryClassification({
        classification: 'restore-session',
        userId: 'unresolved-user',
        repository,
      })
    ).toBe('unknown')

    expect(
      preserveUnresolvedAccountEntryClassification({
        classification: 'existing-account',
        userId: 'unresolved-user',
        repository,
      })
    ).toBe('existing-account')
    expect(repository.has('unresolved-user')).toBe(false)
  })
})

describe('account-entry hydration gate', () => {
  it('keeps guest data protected until new-account adoption completes', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'new-account',
      userId: 'new-user',
    })
    state = reduceAccountEntry(state, { type: 'backup-finished' })

    expect(state.phase).toBe('adopting-guest-data')
    expect(canStartRemoteHydration(state)).toBe(false)

    state = reduceAccountEntry(state, { type: 'adoption-finished', userId: 'new-user' })

    expect(state.phase).toBe('hydrating-account')
    expect(canStartRemoteHydration(state)).toBe(true)
  })

  it.each(['backup-finished', 'backup-failed'] as const)(
    'lets an existing account hydrate after %s',
    backupResult => {
      let state = createAccountEntryState()
      state = reduceAccountEntry(state, { type: 'authentication-started' })
      state = reduceAccountEntry(state, {
        type: 'account-classified',
        classification: 'existing-account',
        userId: 'existing-user',
      })
      state = reduceAccountEntry(state, { type: backupResult })

      expect(state.phase).toBe('hydrating-account')
      expect(canStartRemoteHydration(state)).toBe(true)
    }
  )

  it.each(['provider-link', 'restore-session'] as const)(
    'allows %s to hydrate without guest adoption',
    classification => {
      let state = createAccountEntryState()
      state = reduceAccountEntry(state, { type: 'authentication-started' })
      state = reduceAccountEntry(state, {
        type: 'account-classified',
        classification,
        userId: 'current-user',
      })

      expect(state.phase).toBe('hydrating-account')
      expect(canStartRemoteHydration(state)).toBe(true)
    }
  )

  it('starts neither adoption nor hydration while classification is unknown', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'unknown',
      userId: 'unclassified-user',
    })

    expect(state.phase).toBe('classifying-account-transition')
    expect(canStartRemoteHydration(state)).toBe(false)
  })

  it('aborts adoption if the authenticated UID changes', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'new-account',
      userId: 'new-user',
    })
    state = reduceAccountEntry(state, { type: 'backup-finished' })
    state = reduceAccountEntry(state, { type: 'adoption-finished', userId: 'other-user' })

    expect(state).toMatchObject({
      phase: 'recoverable-error',
      errorCode: 'ACCOUNT_ENTRY_UID_CHANGED',
    })
    expect(canStartRemoteHydration(state)).toBe(false)
  })

  it('resumes a pending adoption for the same restored account before hydration', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'restore-session',
      userId: 'returning-user',
    })
    state = reduceAccountEntry(state, {
      type: 'pending-adoption-found',
      userId: 'returning-user',
    })

    expect(state.phase).toBe('adopting-guest-data')
    expect(canStartRemoteHydration(state)).toBe(false)
  })

  it('keeps local data visible when adoption fails recoverably', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'new-account',
      userId: 'new-user',
    })
    state = reduceAccountEntry(state, { type: 'backup-finished' })
    state = reduceAccountEntry(state, {
      type: 'adoption-failed',
      userId: 'new-user',
      errorCode: 'GUEST_ADOPTION_UNAVAILABLE',
    })

    expect(state).toMatchObject({
      phase: 'recoverable-error',
      errorCode: 'GUEST_ADOPTION_UNAVAILABLE',
    })
    expect(canStartRemoteHydration(state)).toBe(false)
  })

  it('moves checkpoint failures through the same deterministic state machine', () => {
    let state = createAccountEntryState()
    state = reduceAccountEntry(state, { type: 'authentication-started' })
    state = reduceAccountEntry(state, {
      type: 'account-classified',
      classification: 'new-account',
      userId: 'new-user',
    })
    state = reduceAccountEntry(state, {
      type: 'account-entry-failed',
      errorCode: 'GUEST_ADOPTION_CHECKPOINT_INVALID',
    })

    expect(state).toMatchObject({
      phase: 'recoverable-error',
      errorCode: 'GUEST_ADOPTION_CHECKPOINT_INVALID',
      userId: 'new-user',
    })
  })

  it('does not open hydration for an out-of-order backup event', () => {
    const state = reduceAccountEntry(createAccountEntryState(), { type: 'backup-finished' })

    expect(state).toEqual({ phase: 'guest-active' })
    expect(canStartRemoteHydration(state)).toBe(false)
  })
})

describe('AccountEntryAttemptCoordinator', () => {
  it('waits for provider credential metadata when auth state arrives first', async () => {
    const coordinator = new AccountEntryAttemptCoordinator()
    const attempt = coordinator.begin('provider-sign-in')

    const classification = coordinator.classifyAuthenticatedUser('new-user')
    let settled = false
    classification.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    attempt.complete({ userId: 'new-user', credentialIsNewUser: true })

    await expect(classification).resolves.toBe('new-account')
  })

  it('classifies an auth callback without an initiating operation as a restored session', async () => {
    const coordinator = new AccountEntryAttemptCoordinator()

    await expect(coordinator.classifyAuthenticatedUser('restored-user')).resolves.toBe(
      'restore-session'
    )
  })

  it('returns unknown when the credential UID differs from the authenticated UID', async () => {
    const coordinator = new AccountEntryAttemptCoordinator()
    const attempt = coordinator.begin('email-registration')
    const classification = coordinator.classifyAuthenticatedUser('unexpected-user')

    attempt.complete({ userId: 'created-user' })

    await expect(classification).resolves.toBe('unknown')
  })

  it('returns unknown to an awaiting auth callback when authentication fails', async () => {
    const coordinator = new AccountEntryAttemptCoordinator()
    const attempt = coordinator.begin('provider-sign-in')
    const classification = coordinator.classifyAuthenticatedUser('provider-user')

    attempt.fail()

    await expect(classification).resolves.toBe('unknown')
  })
})
