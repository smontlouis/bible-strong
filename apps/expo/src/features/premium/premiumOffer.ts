import type { PurchasesPackage } from 'react-native-purchases'

/** One of the two ways to hold Premium, as the store prices it for this reader. */
export type PremiumOfferPlan = {
  /**
   * The RevenueCat package to buy: a `react-native-purchases` package on the stores, a
   * `purchases-js` one on the Web. Opaque outside the purchases client.
   */
  package: unknown
  price: number
  priceString: string
  /** The price brought to a month, for the annual plan. */
  pricePerMonthString: string | null
  currencyCode: string
}

/** The current offering (`default` in RevenueCat): its annual and monthly packages. */
export type PremiumOffer = {
  annual?: PremiumOfferPlan
  monthly?: PremiumOfferPlan
  /** What the annual plan saves against twelve months, in whole percent. */
  savingsPercent: number | null
}

export const annualSavingsPercent = (annualPrice: number, monthlyPrice: number): number | null => {
  if (monthlyPrice <= 0) return null
  const percent = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
  return percent > 0 ? percent : null
}

export const toPremiumOfferPlan = (
  pkg: PurchasesPackage | null | undefined
): PremiumOfferPlan | undefined =>
  pkg
    ? {
        package: pkg,
        price: pkg.product.price,
        priceString: pkg.product.priceString,
        pricePerMonthString: pkg.product.pricePerMonthString,
        currencyCode: pkg.product.currencyCode,
      }
    : undefined

export const toPremiumOffer = (
  current: {
    annual: PurchasesPackage | null
    monthly: PurchasesPackage | null
  } | null
): PremiumOffer => {
  const annual = toPremiumOfferPlan(current?.annual)
  const monthly = toPremiumOfferPlan(current?.monthly)
  const savingsPercent =
    annual && monthly && annual.currencyCode === monthly.currencyCode
      ? annualSavingsPercent(annual.price, monthly.price)
      : null
  return { annual, monthly, savingsPercent }
}

/** Who buys, for a checkout that asks: the account's address and the app's language. */
export type PremiumBuyer = { email?: string | null; language: string }

/** A package as `purchases-js` gives it on the Web: its price in micro-units of a currency. */
export type WebPremiumPackage = {
  webBillingProduct: { currentPrice: { amountMicros: number; currency: string } }
}

const formatMoney = (amount: number, currency: string, language: string) =>
  new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount)

/**
 * A package of the Web, priced in the app's language rather than the browser's. The annual
 * price brought to a month is rounded down to the cent, so that it never says more than a
 * twelfth of the price.
 */
export const toWebPremiumOfferPlan = (
  pkg: WebPremiumPackage | null | undefined,
  language: string,
  months: 1 | 12
): PremiumOfferPlan | undefined => {
  if (!pkg) return undefined
  const { amountMicros, currency } = pkg.webBillingProduct.currentPrice
  const price = amountMicros / 1_000_000
  return {
    package: pkg,
    price,
    priceString: formatMoney(price, currency, language),
    pricePerMonthString:
      months === 12 ? formatMoney(Math.floor((price / 12) * 100) / 100, currency, language) : null,
    currencyCode: currency,
  }
}

export const toWebPremiumOffer = (
  current: { annual: WebPremiumPackage | null; monthly: WebPremiumPackage | null } | null,
  language: string
): PremiumOffer => {
  const annual = toWebPremiumOfferPlan(current?.annual, language, 12)
  const monthly = toWebPremiumOfferPlan(current?.monthly, language, 1)
  const savingsPercent =
    annual && monthly && annual.currencyCode === monthly.currencyCode
      ? annualSavingsPercent(annual.price, monthly.price)
      : null
  return { annual, monthly, savingsPercent }
}
