import type { PurchasesPackage } from 'react-native-purchases'

import {
  annualSavingsPercent,
  toPremiumOffer,
  toPremiumTrial,
  toWebPremiumOffer,
  trialEndDate,
} from '../premiumOffer'

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

const trialPkg = (
  id: string,
  trial: { introPrice?: object | null; defaultOption?: object | null }
) =>
  ({
    identifier: id,
    product: {
      identifier: id,
      price: 59.99,
      priceString: '59,99 €',
      pricePerMonthString: '5,00 €',
      currencyCode: 'EUR',
      introPrice: null,
      defaultOption: null,
      ...trial,
    },
  }) as unknown as PurchasesPackage

describe('toPremiumTrial', () => {
  it('reads a week as seven days and a year as twelve months', () => {
    expect(toPremiumTrial('WEEK', 1)).toEqual({ unit: 'day', count: 7 })
    expect(toPremiumTrial('day', 3)).toEqual({ unit: 'day', count: 3 })
    expect(toPremiumTrial('MONTH', 1)).toEqual({ unit: 'month', count: 1 })
    expect(toPremiumTrial('YEAR', 1)).toEqual({ unit: 'month', count: 12 })
  })

  it('gives no trial without a length', () => {
    expect(toPremiumTrial('WEEK', 0)).toBeUndefined()
    expect(toPremiumTrial(null, 1)).toBeUndefined()
  })
})

describe('trialEndDate', () => {
  it('ends the trial its length after today, the day of the first payment', () => {
    const from = new Date(2026, 10, 27, 10)
    expect(trialEndDate({ unit: 'day', count: 7 }, from)).toEqual(new Date(2026, 11, 4, 10))
    expect(trialEndDate({ unit: 'month', count: 1 }, from)).toEqual(new Date(2026, 11, 27, 10))
  })
})

describe('the trial of a store product', () => {
  const appStoreTrial = trialPkg('premium.yearly', {
    introPrice: {
      price: 0,
      priceString: '0,00 €',
      cycles: 1,
      period: 'P1W',
      periodUnit: 'WEEK',
      periodNumberOfUnits: 1,
    },
  })

  it('reads the App Store’s free introductory offer when the account may take it', () => {
    const offer = toPremiumOffer({ annual: appStoreTrial, monthly: null }, () => true)
    expect(offer.annual?.trial).toEqual({ unit: 'day', count: 7 })
  })

  it('shows no trial to an account the store would refuse it to', () => {
    const offer = toPremiumOffer({ annual: appStoreTrial, monthly: null }, () => false)
    expect(offer.annual?.trial).toBeUndefined()
    expect(offer.annual).toMatchObject({ price: 59.99 })
  })

  it('takes a paid introductory price for no trial', () => {
    const paidIntro = trialPkg('premium.yearly', {
      introPrice: { price: 1.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 },
    })
    expect(toPremiumOffer({ annual: paidIntro, monthly: null }).annual?.trial).toBeUndefined()
  })

  it('reads the free phase of the option Google Play would sell', () => {
    const playTrial = trialPkg('premium:yearly', {
      defaultOption: { freePhase: { billingPeriod: { unit: 'WEEK', value: 1, iso8601: 'P1W' } } },
    })
    expect(toPremiumOffer({ annual: playTrial, monthly: null }).annual?.trial).toEqual({
      unit: 'day',
      count: 7,
    })
  })

  it('has no trial without an offer', () => {
    expect(toPremiumOffer({ annual: trialPkg('y', {}), monthly: null }).annual).not.toHaveProperty(
      'trial'
    )
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
