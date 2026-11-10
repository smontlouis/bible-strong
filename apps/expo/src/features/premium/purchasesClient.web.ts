import type { PremiumOffer, PremiumOfferPlan } from './premiumOffer'
import type { PremiumStatus } from './premiumStatus'

// The Web and the desktop app will sell through the web checkout run by Stripe (ADR-0110).
// Until then they sell nothing, and RevenueCat's SDK stays out of their bundle.

export const isPurchasesAvailable = (): boolean => false

export const setPremiumListener = (_listener: (status: PremiumStatus) => void): (() => void) => {
  return () => {}
}

export const syncPurchasesIdentity = async (_userId: string | null): Promise<PremiumStatus> => ({
  kind: 'unknown',
})

export const releasePurchasesIdentity = async (): Promise<void> => {}

export const loadPremiumOffer = async (): Promise<PremiumOffer> => ({ savingsPercent: null })

export const buyPremium = async (
  _plan: PremiumOfferPlan
): Promise<'purchased' | 'pending' | 'cancelled'> => {
  throw new Error('Premium is not sold on this surface yet')
}

export const restorePremium = async (): Promise<PremiumStatus> => ({ kind: 'unknown' })

export const resetPurchasesClientForTests = () => {}
