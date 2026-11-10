import type { PurchasesPackage } from 'react-native-purchases'

/** One of the two ways to hold Premium, as the store prices it for this reader. */
export type PremiumOfferPlan = {
  /** The RevenueCat package to buy; opaque outside the purchases client. */
  package: PurchasesPackage
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
