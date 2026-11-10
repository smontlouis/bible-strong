import { NativeModules } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases'

import { revenueCatApiKey } from './premiumConfig'
import {
  toPremiumOffer,
  type PremiumBuyer,
  type PremiumOffer,
  type PremiumOfferPlan,
} from './premiumOffer'
import { toPremiumStatus, type PremiumStatus } from './premiumStatus'

/**
 * The RevenueCat customer of this device follows the signed-in account: its Firebase uid, or an
 * anonymous customer while nobody is signed in (ADR-0110). `undefined` until the SDK is set up.
 */
let configuredUserId: string | null | undefined
let premiumListener: ((status: PremiumStatus) => void) | null = null

// A binary built before RevenueCat joined the app (an older development client, say) runs this
// code without the native module: Premium is then simply not available there.
const hasNativeModule = (): boolean => !!NativeModules.RNPurchases

export const isPurchasesAvailable = (): boolean => !!revenueCatApiKey() && hasNativeModule()

/** Receives Premium each time RevenueCat updates the customer (purchase, renewal, expiry). */
export const setPremiumListener = (listener: (status: PremiumStatus) => void): (() => void) => {
  premiumListener = listener
  return () => {
    if (premiumListener === listener) premiumListener = null
  }
}

const onCustomerInfo = (info: CustomerInfo) => {
  // An anonymous customer holds no Premium: it is never offered without an account.
  if (configuredUserId) premiumListener?.(toPremiumStatus(info))
}

/**
 * Sets the SDK up on the first call, then moves its customer to the account: `logIn` for a new
 * uid, `logOut` when the account signs out. Returns Premium of the account.
 */
export const syncPurchasesIdentity = async (userId: string | null): Promise<PremiumStatus> => {
  const apiKey = revenueCatApiKey()
  if (!apiKey || !hasNativeModule()) return { kind: 'unknown' }

  if (configuredUserId === undefined) {
    void Purchases.setLogLevel(LOG_LEVEL.WARN)
    Purchases.configure({ apiKey, appUserID: userId })
    Purchases.addCustomerInfoUpdateListener(onCustomerInfo)
    configuredUserId = userId
    return userId ? toPremiumStatus(await Purchases.getCustomerInfo()) : { kind: 'none' }
  }

  if (userId === configuredUserId) {
    return userId ? toPremiumStatus(await Purchases.getCustomerInfo()) : { kind: 'none' }
  }

  configuredUserId = userId
  if (userId) {
    const { customerInfo } = await Purchases.logIn(userId)
    return toPremiumStatus(customerInfo)
  }
  if (!(await Purchases.isAnonymous())) await Purchases.logOut()
  return { kind: 'none' }
}

/**
 * Leaves RevenueCat alone for an account that does not see Premium: the SDK is not set up for it,
 * and an account signed in before (a beta account on this device) is signed out of it.
 */
export const releasePurchasesIdentity = async (): Promise<void> => {
  if (configuredUserId === undefined || configuredUserId === null) return
  await syncPurchasesIdentity(null)
}

export const loadPremiumOffer = async (): Promise<PremiumOffer> => {
  const offerings = await Purchases.getOfferings()
  return toPremiumOffer(offerings.current)
}

const isCancellation = (error: unknown): boolean => {
  const { code, userCancelled } = (error ?? {}) as { code?: string; userCancelled?: boolean | null }
  return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || userCancelled === true
}

/**
 * Buys one plan through the store of this build. A payment the store still has to settle (Ask to
 * Buy, a pending Google Play payment) comes back as `pending`; RevenueCat reports it later.
 */
export const buyPremium = async (
  plan: PremiumOfferPlan,
  _reader?: PremiumBuyer
): Promise<'purchased' | 'pending' | 'cancelled'> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.package as PurchasesPackage)
    const status = toPremiumStatus(customerInfo)
    premiumListener?.(status)
    return status.kind === 'active' ? 'purchased' : 'pending'
  } catch (error) {
    if (isCancellation(error)) return 'cancelled'
    throw error
  }
}

/** Asks the store again for the purchases of its account, as App Review requires. */
export const restorePremium = async (): Promise<PremiumStatus> => {
  const status = toPremiumStatus(await Purchases.restorePurchases())
  premiumListener?.(status)
  return status
}

/** For tests only: forgets the configured customer. */
export const resetPurchasesClientForTests = () => {
  configuredUserId = undefined
  premiumListener = null
}
