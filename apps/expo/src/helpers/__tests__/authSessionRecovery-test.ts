import {
  createAuthSessionRecovery,
  SESSION_LOSS_GRACE_MS,
  type AuthSessionRecoveryDependencies,
} from '../authSessionRecovery'

jest.mock('../agentObservability', () => ({
  appLogger: { info: jest.fn(), warn: jest.fn(), captureError: jest.fn() },
}))

const createHarness = () => {
  const world = {
    storedUserId: 'user-1' as string | undefined,
    signedInUserId: undefined as string | undefined,
    lostUserId: undefined as string | undefined,
    loggingOut: false,
    appActive: true,
    foregroundListeners: new Set<() => void>(),
    events: [] as string[],
  }
  const dependencies: AuthSessionRecoveryDependencies = {
    getStoredUserId: () => world.storedUserId,
    getSignedInUserId: () => world.signedInUserId,
    isLogoutInProgress: () => world.loggingOut,
    isAppActive: () => world.appActive,
    onAppActive: callback => {
      world.foregroundListeners.add(callback)
      return () => world.foregroundListeners.delete(callback)
    },
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelScheduled: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    backup: jest.fn(async trigger => {
      world.events.push(`backup:${trigger}:${world.storedUserId}`)
      return true
    }),
    getLostUserId: () => world.lostUserId,
    setLostUserId: userId => {
      world.lostUserId = userId
    },
    allowParkedRetry: jest.fn(userId => {
      world.events.push(`allow-parked-retry:${userId}`)
    }),
    resetLocalAccount: jest.fn(async () => {
      world.events.push(`reset:${world.storedUserId}`)
      world.storedUserId = undefined
    }),
  }
  const comeToForeground = () => {
    world.appActive = true
    world.foregroundListeners.forEach(listener => listener())
  }
  return {
    world,
    dependencies,
    recovery: createAuthSessionRecovery(dependencies),
    comeToForeground,
  }
}

describe('authSessionRecovery', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('detecting a lost session', () => {
    it('keeps the account and backs it up once Firebase stays signed out in the foreground', () => {
      const { world, recovery } = createHarness()

      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS - 1)
      expect(world.lostUserId).toBeUndefined()

      jest.advanceTimersByTime(1)
      expect(world.lostUserId).toBe('user-1')
      expect(world.storedUserId).toBe('user-1')
      expect(world.events).toEqual(['backup:session_lost:user-1'])
    })

    it('waits for the foreground: a background launch with the keychain closed restores the user', () => {
      const { world, recovery, comeToForeground } = createHarness()
      world.appActive = false

      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS * 10)
      expect(world.lostUserId).toBeUndefined()

      // Unlocking the device lets Firebase read the keychain again before the app is shown.
      world.signedInUserId = 'user-1'
      comeToForeground()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBeUndefined()
      expect(world.events).toEqual([])
    })

    it('retains the loss once the app comes to the foreground without a user', () => {
      const { world, recovery, comeToForeground } = createHarness()
      world.appActive = false

      recovery.firebaseSignedOut()
      comeToForeground()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBe('user-1')
    })

    it('forgets the check when Firebase hands the same account back within the grace delay', () => {
      const { world, recovery } = createHarness()

      recovery.firebaseSignedOut()
      expect(recovery.accountSignedIn('user-1')).toBeUndefined()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBeUndefined()
      expect(world.events).toEqual([])
    })

    it('ignores the sign-out of an explicit logout', () => {
      const { world, recovery } = createHarness()
      world.loggingOut = true

      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBeUndefined()
    })

    it('ignores a sign-out once the logout has forgotten the account (deleted account)', () => {
      const { world, recovery } = createHarness()

      recovery.firebaseSignedOut()
      world.storedUserId = undefined
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBeUndefined()
      expect(world.events).toEqual([])
    })

    it('does nothing for a guest', () => {
      const { world, recovery } = createHarness()
      world.storedUserId = undefined

      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      expect(world.lostUserId).toBeUndefined()
    })

    it('clears the loss when the reader logs out', () => {
      const { world, recovery } = createHarness()
      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      recovery.loggedOut()

      expect(world.lostUserId).toBeUndefined()
    })
  })

  describe('signing in again', () => {
    it('resumes the same account with its data and gives refused writes another try', () => {
      const { world, dependencies, recovery } = createHarness()
      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      world.signedInUserId = 'user-1'
      const accountSwitch = recovery.accountSignedIn('user-1')

      expect(accountSwitch).toBeUndefined()
      expect(world.lostUserId).toBeUndefined()
      expect(world.storedUserId).toBe('user-1')
      expect(dependencies.resetLocalAccount).not.toHaveBeenCalled()
      expect(world.events).toEqual(['backup:session_lost:user-1', 'allow-parked-retry:user-1'])
    })

    it('backs up the account shown before another account takes its place', async () => {
      const { world, dependencies, recovery } = createHarness()
      recovery.firebaseSignedOut()
      jest.advanceTimersByTime(SESSION_LOSS_GRACE_MS)

      world.signedInUserId = 'user-2'
      await recovery.accountSignedIn('user-2')

      expect(world.events).toEqual([
        'backup:session_lost:user-1',
        'backup:account_switch:user-1',
        'reset:user-1',
      ])
      expect(world.lostUserId).toBeUndefined()
      expect(dependencies.allowParkedRetry).not.toHaveBeenCalled()
    })

    it('switches accounts even when the loss was never retained', async () => {
      const { world, recovery } = createHarness()
      world.signedInUserId = 'user-2'

      await recovery.accountSignedIn('user-2')

      expect(world.events).toEqual(['backup:account_switch:user-1', 'reset:user-1'])
    })

    it('enters an account from a guest session as before', () => {
      const { world, recovery } = createHarness()
      world.storedUserId = undefined

      expect(recovery.accountSignedIn('user-2')).toBeUndefined()
      expect(world.events).toEqual([])
    })
  })
})
