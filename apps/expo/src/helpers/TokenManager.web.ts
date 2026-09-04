import { getAuth } from 'firebase/auth'
import * as Sentry from '@sentry/react-native'

import { firebaseApp } from './firebaseApp.web'

class TokenManager {
  private lastRefreshTime = 0
  private refreshPromise: Promise<boolean> | null = null
  private readonly refreshCooldown = 5 * 60 * 1000

  canRefresh() {
    return Date.now() - this.lastRefreshTime > this.refreshCooldown
  }

  async tryRefresh(): Promise<boolean> {
    const currentUser = getAuth(firebaseApp).currentUser
    if (!currentUser) return false
    if (!this.canRefresh()) return false
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = currentUser
      .getIdToken(true)
      .then(() => {
        this.lastRefreshTime = Date.now()
        return true
      })
      .catch(error => {
        Sentry.captureException(error, { tags: { feature: 'token_manager_web' } })
        return false
      })

    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }

  async tryRefreshOrWait(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise
    if (!getAuth(firebaseApp).currentUser) return false
    return this.canRefresh() ? this.tryRefresh() : true
  }

  isAuthenticated() {
    return Boolean(getAuth(firebaseApp).currentUser)
  }

  reset() {
    this.lastRefreshTime = 0
    this.refreshPromise = null
  }

  getLastRefreshTime() {
    return this.lastRefreshTime
  }
}

export const tokenManager = new TokenManager()
