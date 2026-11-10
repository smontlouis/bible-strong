import type { CustomerInfo, Package, Purchases } from '@revenuecat/purchases-js'

import i18n from '~i18n'

import { premiumTermsUrl, revenueCatApiKey } from './premiumConfig'
import {
  toWebPremiumOffer,
  type PremiumBuyer,
  type PremiumOffer,
  type PremiumOfferPlan,
} from './premiumOffer'
import { toWebPremiumStatus, type PremiumStatus } from './premiumStatus'

/**
 * Premium on the Web (ADR-0110), through RevenueCat's web SDK and the checkout Stripe runs in the
 * page. The SDK is loaded only for an account that sees Premium, so that the others never
 * download it. RevenueCat's customer is the signed-in account's uid; nobody signed in, the SDK
 * is closed.
 */

type Sdk = typeof import('@revenuecat/purchases-js')

let sdk: Promise<Sdk> | null = null
const loadSdk = (): Promise<Sdk> => (sdk ??= import('@revenuecat/purchases-js'))

let purchases: Purchases | null = null
let configuredUserId: string | null = null
let premiumListener: ((status: PremiumStatus) => void) | null = null
// Changes of account run one after the other: `changeUser` must not race `configure`.
let identityQueue: Promise<unknown> = Promise.resolve()

export const isPurchasesAvailable = (): boolean => !!revenueCatApiKey()

const statusOf = (info: CustomerInfo): PremiumStatus => toWebPremiumStatus(info)

const report = (status: PremiumStatus) => {
  premiumListener?.(status)
  return status
}

/** The account RevenueCat's customer follows, or null while nobody is signed in. */
export const purchasesUserId = (): string | null => configuredUserId

/**
 * Reads Premium again: the reader may have subscribed or cancelled in another tab, in the
 * browser the desktop app sent them to, or on another device.
 */
export const refreshPremium = async (): Promise<PremiumStatus | null> => {
  if (!purchases || !configuredUserId) return null
  return report(statusOf(await purchases.getCustomerInfo()))
}

const REFRESH_EVERY_MS = 15_000
let lastRefresh = 0
let refreshSoon = false

/** The next return to the page reads Premium at once, whatever the last read. */
export const expectPremiumChange = () => {
  refreshSoon = true
}

const onReturn = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  if (!refreshSoon && Date.now() - lastRefresh < REFRESH_EVERY_MS) return
  refreshSoon = false
  lastRefresh = Date.now()
  refreshPremium().catch(error => console.warn('[Premium] RevenueCat did not answer', error))
}

let watching = false
const watchReturns = (watch: boolean) => {
  if (typeof window === 'undefined' || watch === watching) return
  watching = watch
  const method = watch ? 'addEventListener' : 'removeEventListener'
  window[method]('focus', onReturn)
  document[method]('visibilitychange', onReturn)
}

/** Receives Premium each time this client reads it (purchase, return to the page). */
export const setPremiumListener = (listener: (status: PremiumStatus) => void): (() => void) => {
  premiumListener = listener
  return () => {
    if (premiumListener === listener) premiumListener = null
  }
}

const closeSdk = () => {
  purchases?.close()
  purchases = null
  configuredUserId = null
  watchReturns(false)
}

/** Sets the SDK up for the account, or moves it to another one. Returns Premium of the account. */
export const syncPurchasesIdentity = (userId: string | null): Promise<PremiumStatus> => {
  const next = identityQueue.then(async (): Promise<PremiumStatus> => {
    const apiKey = revenueCatApiKey()
    if (!apiKey) return { kind: 'unknown' }
    if (!userId) {
      closeSdk()
      return { kind: 'none' }
    }
    const { Purchases } = await loadSdk()
    if (!purchases) {
      purchases = Purchases.configure({ apiKey, appUserId: userId })
    } else if (userId !== configuredUserId) {
      await purchases.changeUser(userId)
    }
    configuredUserId = userId
    watchReturns(true)
    lastRefresh = Date.now()
    return statusOf(await purchases.getCustomerInfo())
  })
  identityQueue = next.catch(() => undefined)
  return next
}

/** An account that does not see Premium leaves RevenueCat alone: the SDK is closed. */
export const releasePurchasesIdentity = async (): Promise<void> => {
  const next = identityQueue.then(closeSdk)
  identityQueue = next.catch(() => undefined)
  await next
}

const requirePurchases = (): Purchases => {
  if (!purchases) throw new Error('PREMIUM_NOT_CONFIGURED')
  return purchases
}

/** The SDK once the account's setup has run: it loads asynchronously, unlike the native one. */
const readyPurchases = async (): Promise<Purchases> => {
  await identityQueue
  return requirePurchases()
}

export const loadPremiumOffer = async (): Promise<PremiumOffer> => {
  const offerings = await (await readyPurchases()).getOfferings()
  return toWebPremiumOffer(offerings.current, i18n.language)
}

/** The RevenueCat package of a plan (`$rc_annual`, `$rc_monthly`). */
export const packageIdentifier = (plan: PremiumOfferPlan): string =>
  (plan.package as Package).identifier

const checkoutLanguage = (language: string) => (language === 'en' ? 'en' : 'fr')

const errorCodeOf = (error: unknown): number | undefined =>
  (error as { errorCode?: number } | null)?.errorCode

/**
 * Opens RevenueCat's checkout over the page, with Stripe's payment form in it. The account's
 * address skips RevenueCat's own e-mail step; the app's welcome replaces its success page.
 */
export const buyPremium = async (
  plan: PremiumOfferPlan,
  reader?: PremiumBuyer
): Promise<'purchased' | 'pending' | 'cancelled'> => {
  const { ErrorCode } = await loadSdk()
  const language = checkoutLanguage(reader?.language ?? i18n.language)
  const email = reader?.email || undefined
  const sdkInstance = await readyPurchases()
  const checkout = (customerEmail: string | undefined) =>
    sdkInstance.purchase({
      rcPackage: plan.package as Package,
      customerEmail,
      selectedLocale: language,
      defaultLocale: 'en',
      skipSuccessPage: true,
      termsAndConditionsUrl: premiumTermsUrl(language),
    })
  try {
    let customerInfo: CustomerInfo
    try {
      ;({ customerInfo } = await checkout(email))
    } catch (error) {
      // RevenueCat refuses an address whose domain receives no mail (an account opened with a
      // placeholder address): the checkout opens again and asks for one. Its flow reports the
      // refusal as an invalid purchase, its backend as an invalid address.
      const code = errorCodeOf(error)
      const refusedAddress =
        code === ErrorCode.InvalidEmailError || code === ErrorCode.PurchaseInvalidError
      if (!email || !refusedAddress) throw error
      ;({ customerInfo } = await checkout(undefined))
    }
    const status = report(statusOf(customerInfo))
    return status.kind === 'active' ? 'purchased' : 'pending'
  } catch (error) {
    const code = errorCodeOf(error)
    if (code === ErrorCode.UserCancelledError) return 'cancelled'
    // Already subscribed, through this checkout or another channel: Premium is read again.
    if (code === ErrorCode.ProductAlreadyPurchasedError) {
      const status = await refreshPremium()
      if (status?.kind === 'active') return 'purchased'
    }
    throw error
  }
}

/** No store holds purchases on the Web: restoring reads Premium again. */
export const restorePremium = async (): Promise<PremiumStatus> =>
  (await refreshPremium()) ?? { kind: 'none' }

/** For tests only: forgets the SDK and the configured customer. */
export const resetPurchasesClientForTests = () => {
  closeSdk()
  sdk = null
  premiumListener = null
  identityQueue = Promise.resolve()
  lastRefresh = 0
  refreshSoon = false
}
