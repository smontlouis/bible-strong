import auth from '@react-native-firebase/auth'
import * as Sentry from '@sentry/react-native'

/**
 * TokenManager - Safety net pour les edge cases où le SDK Firestore
 * ne refresh pas assez vite le token (background prolongé, race conditions, etc.)
 *
 * IMPORTANT: Ce n'est PAS un remplacement du SDK Firestore qui gère
 * automatiquement le token refresh. C'est juste un fallback pour les cas edge.
 */
class TokenManager {
  private lastRefreshTime: number = 0

  // Cooldown de 5 minutes entre refreshes manuels
  // Empêche les refreshes trop fréquents si erreurs répétées
  private readonly REFRESH_COOLDOWN = 5 * 60 * 1000 // 5 minutes

  /**
   * Vérifie si on peut refresh (pas de refresh récent)
   */
  canRefresh(): boolean {
    const now = Date.now()
    const timeSinceLastRefresh = now - this.lastRefreshTime
    return timeSinceLastRefresh > this.REFRESH_COOLDOWN
  }

  /**
   * Refresh manuel du token - SEULEMENT pour les edge cases
   * Utilisé en cas d'erreur permission-denied détectée
   *
   * @returns true si refresh réussi, false sinon
   */
  async tryRefresh(): Promise<boolean> {
    const currentUser = auth().currentUser

    if (!currentUser) {
      console.warn('[TokenManager] No current user, cannot refresh')
      return false
    }

    if (!this.canRefresh()) {
      console.log('[TokenManager] Refresh cooldown active, skipping')
      return false
    }

    try {
      console.log('[TokenManager] Attempting manual token refresh (edge case fallback)...')

      const token = await currentUser.getIdToken(true) // Force refresh

      this.lastRefreshTime = Date.now()

      console.log('[TokenManager] Manual refresh succeeded')

      return true
    } catch (error) {
      console.error('[TokenManager] Manual refresh failed:', error)

      Sentry.captureException(error, {
        tags: {
          feature: 'token_manager',
          action: 'manual_refresh',
        },
        extra: {
          userId: currentUser.uid,
          lastRefreshTime: this.lastRefreshTime,
        },
      })

      return false
    }
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   * Wrapper utile pour vérifier auth state
   */
  isAuthenticated(): boolean {
    return !!auth().currentUser
  }

  /**
   * Reset lors du logout
   */
  reset() {
    this.lastRefreshTime = 0
    console.log('[TokenManager] Reset')
  }

  /**
   * Get le timestamp du dernier refresh (pour debugging)
   */
  getLastRefreshTime(): number {
    return this.lastRefreshTime
  }
}

export const tokenManager = new TokenManager()
