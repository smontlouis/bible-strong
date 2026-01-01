/**
 * Cleanup Registry
 *
 * This module provides a central registry for cleanup functions that need to be
 * called before logout. It breaks the require cycle between:
 * - useLogin.ts -> FireAuth.ts -> useLiveUpdates.ts/useTabGroupsSync.ts -> useLogin.ts
 *
 * Modules register their cleanup functions here, and FireAuth calls runAllCleanups()
 * before signing out.
 */

type CleanupFn = () => void

const cleanupFunctions: Map<string, CleanupFn> = new Map()

/**
 * Register a cleanup function to be called before logout.
 * @param key Unique identifier for this cleanup (e.g., 'firestoreSubscriptions')
 * @param fn The cleanup function to run
 */
export const registerCleanup = (key: string, fn: CleanupFn): void => {
  cleanupFunctions.set(key, fn)
}

/**
 * Unregister a cleanup function.
 * @param key The key used when registering
 */
export const unregisterCleanup = (key: string): void => {
  cleanupFunctions.delete(key)
}

/**
 * Run all registered cleanup functions.
 * Called by FireAuth before signing out.
 */
export const runAllCleanups = (): void => {
  console.log('[CleanupRegistry] Running all cleanup functions...')
  cleanupFunctions.forEach((fn, key) => {
    try {
      console.log(`[CleanupRegistry] Running cleanup: ${key}`)
      fn()
    } catch (error) {
      console.error(`[CleanupRegistry] Error in cleanup "${key}":`, error)
    }
  })
  cleanupFunctions.clear()
  console.log('[CleanupRegistry] All cleanups complete')
}
