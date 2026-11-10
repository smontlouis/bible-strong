import Purchases from 'react-native-purchases'

import type { PremiumOfferPlan } from '../premiumOffer'
import {
  buyPremium,
  isPurchasesAvailable,
  releasePurchasesIdentity,
  resetPurchasesClientForTests,
  restorePremium,
  setPremiumListener,
  syncPurchasesIdentity,
} from '../purchasesClient'

let mockApiKey: string | undefined = 'test_key'
const mockNativeModules: { RNPurchases?: object } = { RNPurchases: {} }

jest.mock('react-native', () => ({
  get NativeModules() {
    return mockNativeModules
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
