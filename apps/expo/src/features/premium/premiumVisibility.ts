import { hasBetaAccess } from '~helpers/betaAccess'
import useLogin from '~helpers/useLogin'

import { isPurchasesAvailable } from './purchasesClient'
import { salesChannel } from './salesChannel'

/**
 * Premium is shown only where this surface sells it, and until sales open only to the accounts of
 * the beta list (ADR-0110: no surface mentions Premium before then). Other accounts see none of
 * it: no row, no offer, no page, and RevenueCat is not called for them.
 */
export const premiumVisible = (uid?: string | null) =>
  salesChannel() !== 'none' && isPurchasesAvailable() && hasBetaAccess(uid)

export const usePremiumVisible = () => {
  const { isLogged, user } = useLogin()
  return premiumVisible(isLogged ? user.id : null)
}
