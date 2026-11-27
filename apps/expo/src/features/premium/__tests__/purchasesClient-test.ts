import Purchases from 'react-native-purchases'

import type { PremiumOfferPlan } from '../premiumOffer'
import {
  buyPremium,
  isPurchasesAvailable,
  loadPremiumOffer,
  releasePurchasesIdentity,
  resetPurchasesClientForTests,
  restorePremium,
  setPremiumListener,
  syncPurchasesIdentity,
} from '../purchasesClient'

let mockApiKey: string | undefined = 'test_key'
const mockNativeModules: { RNPurchases?: object } = { RNPurchases: {} }
const mockPlatform = { OS: 'ios' }

jest.mock('react-native', () => ({
  get NativeModules() {
    return mockNativeModules
  },
  get Platform() {
    return mockPlatform
  },
}))

jest.mock('../premiumConfig', () => ({
  revenueCatApiKey: () => mockApiKey,
}))

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(() => Promise.resolve()),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    isAnonymous: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getOfferings: jest.fn(),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
  },
  LOG_LEVEL: { WARN: 'WARN' },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: '1' },
}))

const sdk = jest.mocked(Purchases)

const premiumInfo = {
  entitlements: {
    active: { premium: { expirationDate: null, willRenew: true, store: 'TEST_STORE' } },
  },
  managementURL: null,
}
const freeInfo = { entitlements: { active: {} }, managementURL: null }

beforeEach(() => {
  jest.clearAllMocks()
  resetPurchasesClientForTests()
  mockApiKey = 'test_key'
  mockNativeModules.RNPurchases = {}
  mockPlatform.OS = 'ios'
})

describe('the free trial of the offer', () => {
  const yearly = {
    identifier: '$rc_annual',
    product: {
      identifier: 'premium.yearly',
      price: 59.99,
      priceString: '59,99 €',
      pricePerMonthString: '5,00 €',
      currencyCode: 'EUR',
      introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 },
      defaultOption: null,
    },
  }
  const monthly = {
    identifier: '$rc_monthly',
    product: {
      identifier: 'premium.monthly',
      price: 8.99,
      priceString: '8,99 €',
      pricePerMonthString: '8,99 €',
      currencyCode: 'EUR',
      introPrice: null,
      defaultOption: null,
    },
  }
  const offerings = { current: { annual: yearly, monthly } }

  it('asks the App Store only about the products that have a trial', async () => {
    sdk.getOfferings.mockResolvedValue(offerings as never)
    sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      'premium.yearly': { status: 2, description: '' },
    } as never)
    const offer = await loadPremiumOffer()
    expect(sdk.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith(['premium.yearly'])
    expect(offer.annual?.trial).toEqual({ unit: 'day', count: 7 })
    expect(offer.monthly?.trial).toBeUndefined()
  })

  it('promises no trial when the App Store refuses it or cannot say', async () => {
    sdk.getOfferings.mockResolvedValue(offerings as never)
    for (const status of [0, 1]) {
      sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
        'premium.yearly': { status, description: '' },
      } as never)
      expect((await loadPremiumOffer()).annual?.trial).toBeUndefined()
    }
    sdk.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('offline'))
    expect((await loadPremiumOffer()).annual?.trial).toBeUndefined()
  })

  it('trusts Google Play, which only sells the offers an account may take', async () => {
    mockPlatform.OS = 'android'
    sdk.getOfferings.mockResolvedValue(offerings as never)
    expect((await loadPremiumOffer()).annual?.trial).toEqual({ unit: 'day', count: 7 })
    expect(sdk.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled()
  })
})

describe('syncPurchasesIdentity', () => {
  it('does nothing in a build without a RevenueCat key', async () => {
    mockApiKey = undefined
    await expect(syncPurchasesIdentity('uid-1')).resolves.toEqual({ kind: 'unknown' })
    expect(sdk.configure).not.toHaveBeenCalled()
  })

  it('does nothing in a binary built without the native module', async () => {
    delete mockNativeModules.RNPurchases
    expect(isPurchasesAvailable()).toBe(false)
    await expect(syncPurchasesIdentity('uid-1')).resolves.toEqual({ kind: 'unknown' })
    expect(sdk.configure).not.toHaveBeenCalled()
  })

  it('sets the SDK up on the signed-in account', async () => {
    sdk.getCustomerInfo.mockResolvedValue(premiumInfo as never)
    await expect(syncPurchasesIdentity('uid-1')).resolves.toMatchObject({ kind: 'active' })
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'test_key', appUserID: 'uid-1' })
    expect(sdk.logIn).not.toHaveBeenCalled()
  })

  it('starts anonymous while nobody is signed in, then logs the account in', async () => {
    await expect(syncPurchasesIdentity(null)).resolves.toEqual({ kind: 'none' })
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'test_key', appUserID: null })

    sdk.logIn.mockResolvedValue({ customerInfo: freeInfo, created: false } as never)
    await expect(syncPurchasesIdentity('uid-1')).resolves.toEqual({ kind: 'none' })
    expect(sdk.logIn).toHaveBeenCalledWith('uid-1')
    expect(sdk.configure).toHaveBeenCalledTimes(1)
  })

  it('logs out when the account signs out', async () => {
    sdk.getCustomerInfo.mockResolvedValue(freeInfo as never)
    await syncPurchasesIdentity('uid-1')
    sdk.isAnonymous.mockResolvedValue(false)
    await expect(syncPurchasesIdentity(null)).resolves.toEqual({ kind: 'none' })
    expect(sdk.logOut).toHaveBeenCalledTimes(1)
  })

  it('does not log an anonymous customer out', async () => {
    await syncPurchasesIdentity(null)
    sdk.logIn.mockResolvedValue({ customerInfo: freeInfo, created: false } as never)
    await syncPurchasesIdentity('uid-1')
    sdk.isAnonymous.mockResolvedValue(true)
    await syncPurchasesIdentity(null)
    expect(sdk.logOut).not.toHaveBeenCalled()
  })

  it('hands RevenueCat updates of the account to the listener, not those of an anonymous one', async () => {
    const listener = jest.fn()
    setPremiumListener(listener)
    await syncPurchasesIdentity(null)
    const onUpdate = sdk.addCustomerInfoUpdateListener.mock.calls[0]![0]

    onUpdate(premiumInfo as never)
    expect(listener).not.toHaveBeenCalled()

    sdk.logIn.mockResolvedValue({ customerInfo: freeInfo, created: false } as never)
    await syncPurchasesIdentity('uid-1')
    onUpdate(premiumInfo as never)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'active' }))
  })
})

describe('buyPremium', () => {
  const plan = { package: { identifier: '$rc_annual' } } as unknown as PremiumOfferPlan

  it('reports a purchase that grants Premium', async () => {
    const listener = jest.fn()
    setPremiumListener(listener)
    sdk.purchasePackage.mockResolvedValue({ customerInfo: premiumInfo } as never)
    await expect(buyPremium(plan)).resolves.toBe('purchased')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'active' }))
  })

  it('reports a payment the store still has to settle as pending', async () => {
    sdk.purchasePackage.mockResolvedValue({ customerInfo: freeInfo } as never)
    await expect(buyPremium(plan)).resolves.toBe('pending')
  })

  it('treats the reader closing the store sheet as a cancellation', async () => {
    sdk.purchasePackage.mockRejectedValue({ code: '1', userCancelled: true })
    await expect(buyPremium(plan)).resolves.toBe('cancelled')
  })

  it('lets any other failure through', async () => {
    sdk.purchasePackage.mockRejectedValue(new Error('store unavailable'))
    await expect(buyPremium(plan)).rejects.toThrow('store unavailable')
  })
})

describe('restorePremium', () => {
  it('returns Premium after asking the store again', async () => {
    sdk.restorePurchases.mockResolvedValue(premiumInfo as never)
    await expect(restorePremium()).resolves.toMatchObject({ kind: 'active' })
  })
})

it('leaves RevenueCat untouched for an account that does not see Premium', async () => {
  await releasePurchasesIdentity()
  expect(sdk.configure).not.toHaveBeenCalled()
  expect(sdk.logOut).not.toHaveBeenCalled()

  // A beta account signed in on this device is signed out when another account takes over.
  sdk.getCustomerInfo.mockResolvedValueOnce(freeInfo as never)
  await syncPurchasesIdentity('beta-account')
  sdk.isAnonymous.mockResolvedValueOnce(false)
  await releasePurchasesIdentity()
  expect(sdk.logOut).toHaveBeenCalledTimes(1)
  await releasePurchasesIdentity()
  expect(sdk.logOut).toHaveBeenCalledTimes(1)
})
