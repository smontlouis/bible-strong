import type { PurchasesPackage } from 'react-native-purchases'

import { annualSavingsPercent, toPremiumOffer, toWebPremiumOffer } from '../premiumOffer'

const pkg = (price: number, currencyCode = 'EUR', pricePerMonthString: string | null = null) =>
  ({
    identifier: String(price),
    product: { price, priceString: `${price} €`, pricePerMonthString, currencyCode },
  }) as unknown as PurchasesPackage

describe('annualSavingsPercent', () => {
  it('compares the year with twelve months', () => {
    expect(annualSavingsPercent(59.99, 8.99)).toBe(44)
  })

  it('reports no saving when the year costs as much', () => {
    expect(annualSavingsPercent(120, 10)).toBeNull()
    expect(annualSavingsPercent(10, 0)).toBeNull()
  })
})

describe('toPremiumOffer', () => {
  it('reads the annual and monthly packages of the current offering', () => {
    const offer = toPremiumOffer({ annual: pkg(59.99, 'EUR', '5,00 €'), monthly: pkg(8.99) })
    expect(offer.annual).toMatchObject({ price: 59.99, pricePerMonthString: '5,00 €' })
    expect(offer.monthly).toMatchObject({ price: 8.99 })
    expect(offer.savingsPercent).toBe(44)
  })

  it('shows no saving across two currencies', () => {
    expect(
      toPremiumOffer({ annual: pkg(59.99, 'EUR'), monthly: pkg(9.99, 'USD') }).savingsPercent
    ).toBeNull()
  })

  it('is empty without a current offering', () => {
    expect(toPremiumOffer(null)).toEqual({
      annual: undefined,
      monthly: undefined,
      savingsPercent: null,
    })
  })
})

describe('toWebPremiumOffer', () => {
  const webPkg = (amountMicros: number, currency = 'EUR') => ({
    webBillingProduct: { currentPrice: { amountMicros, currency } },
  })
  // Intl separates the euro sign with a no-break space, narrow or not depending on the engine.
  const plain = (text?: string | null) => text?.replace(/\s/g, ' ')

  it('prices the plans in the app’s language, a twelfth of the year rounded down', () => {
    const fr = toWebPremiumOffer({ annual: webPkg(59_990_000), monthly: webPkg(8_990_000) }, 'fr')
    expect(plain(fr.annual?.priceString)).toBe('59,99 €')
    expect(plain(fr.annual?.pricePerMonthString)).toBe('4,99 €')
    expect(plain(fr.monthly?.priceString)).toBe('8,99 €')
    expect(fr.monthly?.pricePerMonthString).toBeNull()
    expect(fr.savingsPercent).toBe(44)
    const en = toWebPremiumOffer({ annual: webPkg(59_990_000), monthly: null }, 'en')
    expect(en.annual?.priceString).toBe('€59.99')
    expect(en.monthly).toBeUndefined()
  })

  it('is empty without a current offering', () => {
    expect(toWebPremiumOffer(null, 'fr')).toEqual({
      annual: undefined,
      monthly: undefined,
      savingsPercent: null,
    })
  })
})
