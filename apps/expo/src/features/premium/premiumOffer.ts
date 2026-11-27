import type { PurchasesPackage } from 'react-native-purchases'

/**
 * A free trial the store gives before the first payment, as long as the store says (a week,
 * seven days, a month): the app never assumes its length.
 */
export type PremiumTrial = { unit: 'day' | 'month'; count: number }

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
  /**
   * The free trial this reader would start by buying the plan: only when the store offers one and
   * this account may still take it. Undefined everywhere else, the Web included.
   */
  trial?: PremiumTrial
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

/**
 * A trial length as the stores write it: a unit and a number of them. Weeks become days, so that
 * a week reads « 7 jours »; years become months.
 */
export const toPremiumTrial = (
  unit: string | null | undefined,
  count: number | null | undefined
): PremiumTrial | undefined => {
  if (!count || count <= 0) return undefined
  switch (unit?.toUpperCase()) {
    case 'DAY':
      return { unit: 'day', count }
    case 'WEEK':
      return { unit: 'day', count: count * 7 }
    case 'MONTH':
      return { unit: 'month', count }
    case 'YEAR':
      return { unit: 'month', count: count * 12 }
    default:
      return undefined
  }
}

/** When a trial started today ends, which is also the day of the first payment. */
export const trialEndDate = (trial: PremiumTrial, from: Date = new Date()): Date => {
  const end = new Date(from)
  if (trial.unit === 'day') end.setDate(end.getDate() + trial.count)
  else end.setMonth(end.getMonth() + trial.count)
  return end
}

/**
 * The free trial of a store product, before eligibility. Google Play gives the phases of the
 * option it would sell, and only offers an account may take, so a free phase there is the
 * trial this account starts. The App Store gives the introductory offer of the product whoever
 * reads it: eligibility is checked apart (`loadPremiumOffer`).
 */
export const storeProductTrial = (
  product: PurchasesPackage['product']
): PremiumTrial | undefined => {
  const freePhase = product.defaultOption?.freePhase
  if (freePhase?.billingPeriod) {
    return toPremiumTrial(freePhase.billingPeriod.unit, freePhase.billingPeriod.value)
  }
  const intro = product.introPrice
  if (intro && intro.price === 0) return toPremiumTrial(intro.periodUnit, intro.periodNumberOfUnits)
  return undefined
}

export const toPremiumOfferPlan = (
  pkg: PurchasesPackage | null | undefined,
  /** Whether this account may still take the trial; the App Store answers it apart. */
  trialEligible = true
): PremiumOfferPlan | undefined => {
  if (!pkg) return undefined
  const trial = trialEligible ? storeProductTrial(pkg.product) : undefined
  return {
    package: pkg,
    price: pkg.product.price,
    priceString: pkg.product.priceString,
    pricePerMonthString: pkg.product.pricePerMonthString,
    currencyCode: pkg.product.currencyCode,
    ...(trial ? { trial } : {}),
  }
}

export const toPremiumOffer = (
  current: {
    annual: PurchasesPackage | null
    monthly: PurchasesPackage | null
  } | null,
  /** The products whose trial this account may take; every product when not given. */
  trialEligible: (productId: string) => boolean = () => true
): PremiumOffer => {
  const plan = (pkg: PurchasesPackage | null | undefined) =>
    toPremiumOfferPlan(pkg, pkg ? trialEligible(pkg.product.identifier) : false)
  const annual = plan(current?.annual)
  const monthly = plan(current?.monthly)
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
