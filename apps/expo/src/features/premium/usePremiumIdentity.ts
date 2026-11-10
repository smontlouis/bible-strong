import { useSetAtom } from 'jotai/react'
import { useEffect } from 'react'

import useLogin from '~helpers/useLogin'

import { premiumStatusAtom } from './premiumStatus'
import { setPremiumListener, syncPurchasesIdentity } from './purchasesClient'

/**
 * Keeps RevenueCat's customer on the signed-in account and `premiumStatusAtom` current
 * (ADR-0110). Mounted once, with the other start-up hooks.
 */
export const usePremiumIdentity = () => {
  const { isLogged, user } = useLogin()
  const setStatus = useSetAtom(premiumStatusAtom)
  const userId = isLogged && user.id ? user.id : null

  useEffect(() => setPremiumListener(setStatus), [setStatus])

  useEffect(() => {
    let cancelled = false
    syncPurchasesIdentity(userId)
      .then(status => {
        if (!cancelled) setStatus(status)
      })
      .catch(error => {
        console.warn('[Premium] RevenueCat did not answer', error)
        if (!cancelled) setStatus(userId ? { kind: 'unknown' } : { kind: 'none' })
      })
    return () => {
      cancelled = true
    }
  }, [userId, setStatus])
}
