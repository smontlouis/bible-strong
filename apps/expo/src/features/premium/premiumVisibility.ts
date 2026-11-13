import {
  type AssistantOpening,
  hasOpeningAccess,
  useAssistantOpening,
} from '~helpers/assistantOpening'
import useLogin from '~helpers/useLogin'

import { isPurchasesAvailable } from './purchasesClient'
import { salesChannel } from './salesChannel'

/**
 * Premium is shown only where this surface sells it, and it opens with the assistant
 * (`~helpers/assistantOpening`): until then only the beta list sees it (ADR-0110: no surface
 * mentions Premium before sales open). Other accounts see none of it: no row, no offer, no page,
 * and RevenueCat is not called for them.
 */
export const premiumVisible = (opening: AssistantOpening, uid?: string | null) =>
  salesChannel() !== 'none' && isPurchasesAvailable() && hasOpeningAccess(opening, uid)

export const usePremiumVisible = () => {
  const { isLogged, user } = useLogin()
  return premiumVisible(useAssistantOpening(), isLogged ? user.id : null)
}
