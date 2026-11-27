import { atom } from 'jotai/vanilla'

/** The one RevenueCat entitlement every sales channel grants (ADR-0110). */
export const PREMIUM_ENTITLEMENT = 'premium'

/** Where a Premium entitlement was bought, as RevenueCat names it. */
export type PremiumStore =
  | 'APP_STORE'
  | 'MAC_APP_STORE'
  | 'PLAY_STORE'
  | 'STRIPE'
  | 'PROMOTIONAL'
  | 'TEST_STORE'
  | 'OTHER'

export type PremiumStatus =
  /** RevenueCat has not answered yet, or this build sells nothing. */
  | { kind: 'unknown' }
  | { kind: 'none' }
  | {
      kind: 'active'
      store: PremiumStore
      /** ISO date of the end of the current period, or null for a grant with no end. */
      expiresAt: string | null
      willRenew: boolean
      /** In the store's free trial: `expiresAt` is then its end, the day of the first payment. */
      inTrial: boolean
      /** Where the reader manages the subscription, when the store gives one. */
      managementURL: string | null
    }

/** The part of RevenueCat's CustomerInfo that decides Premium. */
export type PremiumCustomerInfo = {
  entitlements: {
    active: Record<
      string,
      | {
          expirationDate: string | null
          willRenew: boolean
          store: string
          /** NORMAL, INTRO, TRIAL or PREPAID; lower case on the Web. */
          periodType?: string | null
        }
      | undefined
    >
  }
  managementURL: string | null
}

const KNOWN_STORES: PremiumStore[] = [
  'APP_STORE',
  'MAC_APP_STORE',
  'PLAY_STORE',
  'STRIPE',
  'PROMOTIONAL',
  'TEST_STORE',
]

export const toPremiumStatus = (info: PremiumCustomerInfo): PremiumStatus => {
  const entitlement = info.entitlements.active[PREMIUM_ENTITLEMENT]
  if (!entitlement) return { kind: 'none' }
  const store = KNOWN_STORES.find(known => known === entitlement.store) ?? 'OTHER'
  return {
    kind: 'active',
    store,
    expiresAt: entitlement.expirationDate,
    willRenew: entitlement.willRenew,
    inTrial: entitlement.periodType?.toUpperCase() === 'TRIAL',
    managementURL: info.managementURL,
  }
}

/** The same part of CustomerInfo as `purchases-js` gives it on the Web: dates, lower-case stores. */
export type WebCustomerInfo = {
  entitlements: {
    active: Record<
      string,
      | {
          expirationDate: Date | null
          willRenew: boolean
          store: string
          periodType?: string | null
        }
      | undefined
    >
  }
  managementURL: string | null
}

export const toWebPremiumStatus = (info: WebCustomerInfo): PremiumStatus =>
  toPremiumStatus({
    entitlements: {
      active: Object.fromEntries(
        Object.entries(info.entitlements.active).map(([id, entitlement]) => [
          id,
          entitlement && {
            expirationDate: entitlement.expirationDate?.toISOString() ?? null,
            willRenew: entitlement.willRenew,
            store: entitlement.store.toUpperCase(),
            periodType: entitlement.periodType,
          },
        ])
      ),
    },
    managementURL: info.managementURL,
  })

/** Premium of the signed-in account, kept current by `usePremiumIdentity`. */
export const premiumStatusAtom = atom<PremiumStatus>({ kind: 'unknown' })
