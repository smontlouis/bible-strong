import { openUrl } from '@tauri-apps/plugin-opener'

import { revenueCatApiKey, revenueCatPurchaseLink } from './premiumConfig'
import type { PremiumBuyer, PremiumOfferPlan } from './premiumOffer'
import { expectPremiumChange, packageIdentifier, purchasesUserId } from './purchasesClient.web'

/**
 * Premium in the desktop app's installer builds (ADR-0110): RevenueCat's web SDK reads the offer
 * and Premium, as on the Web, but the checkout opens in the reader's browser, through the Web
 * Purchase Link of the offering. There the reader has their wallets and saved cards, and the
 * checkout returns to a real web origin. The app reads Premium again when its window comes back
 * to the front.
 */
export {
  loadPremiumOffer,
  refreshPremium,
  releasePurchasesIdentity,
  resetPurchasesClientForTests,
  restorePremium,
  setPremiumListener,
  syncPurchasesIdentity,
} from './purchasesClient.web'

export const isPurchasesAvailable = (): boolean =>
  !!revenueCatApiKey() && !!revenueCatPurchaseLink()

/** The Web Purchase Link for the account, with the plan chosen and the account's address. */
export const purchaseLinkUrl = (
  link: string,
  userId: string,
  plan: PremiumOfferPlan,
  reader?: PremiumBuyer
): string => {
  const url = new URL(encodeURIComponent(userId), link.endsWith('/') ? link : `${link}/`)
  url.searchParams.set('package_id', packageIdentifier(plan))
  if (reader?.email) url.searchParams.set('email', reader.email)
  return url.toString()
}

/**
 * Opens the checkout in the reader's browser. The purchase ends there: `pending` until the app,
 * back in front, reads Premium again.
 */
export const buyPremium = async (
  plan: PremiumOfferPlan,
  reader?: PremiumBuyer
): Promise<'purchased' | 'pending' | 'cancelled'> => {
  const link = revenueCatPurchaseLink()
  const userId = purchasesUserId()
  if (!link || !userId) throw new Error('PREMIUM_NOT_CONFIGURED')
  expectPremiumChange()
  await openUrl(purchaseLinkUrl(link, userId, plan, reader))
  return 'pending'
}
