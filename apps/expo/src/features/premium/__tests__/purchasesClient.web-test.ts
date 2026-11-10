import type { PremiumOfferPlan } from '../premiumOffer'
import {
  buyPremium,
  loadPremiumOffer,
  releasePurchasesIdentity,
  resetPurchasesClientForTests,
  restorePremium,
  setPremiumListener,
  syncPurchasesIdentity,
} from '../purchasesClient.web'

let mockApiKey: string | undefined = 'strp_sb_test'

jest.mock('../premiumConfig', () => ({
  revenueCatApiKey: () => mockApiKey,
  premiumTermsUrl: (language: string) => `https://bible-strong.app/terms-${language}`,
}))

jest.mock('~i18n', () => ({ __esModule: true, default: { language: 'fr' } }))

const mockInstance = {
  getCustomerInfo: jest.fn(),
  changeUser: jest.fn(),
  getOfferings: jest.fn(),
  purchase: jest.fn(),
  close: jest.fn(),
}
const mockConfigure = jest.fn((_config: unknown) => mockInstance)

jest.mock('@revenuecat/purchases-js', () => ({
  Purchases: { configure: (config: unknown) => mockConfigure(config) },
  ErrorCode: {
    UserCancelledError: 1,
    PurchaseInvalidError: 4,
    ProductAlreadyPurchasedError: 6,
    InvalidEmailError: 38,
  },
}))

const premiumInfo = {
  entitlements: {
    active: {
      premium: {
        expirationDate: new Date('2027-11-10T12:00:00Z'),
        willRenew: true,
        store: 'stripe',
      },
    },
  },
  managementURL: 'https://billing.stripe.com/p/login/test',
}
const freeInfo = { entitlements: { active: {} }, managementURL: null }

const webPackage = (identifier: string, amountMicros: number) => ({
  identifier,
  webBillingProduct: { currentPrice: { amountMicros, currency: 'EUR' } },
})

const plan = (identifier: string) =>
  ({ package: webPackage(identifier, 59_990_000) }) as unknown as PremiumOfferPlan

beforeEach(() => {
  jest.clearAllMocks()
  resetPurchasesClientForTests()
  mockApiKey = 'strp_sb_test'
  mockInstance.getCustomerInfo.mockResolvedValue(freeInfo)
})

describe('the account on the Web', () => {
  it('sets RevenueCat up for the signed-in account and reads its Premium', async () => {
    mockInstance.getCustomerInfo.mockResolvedValue(premiumInfo)
    await expect(syncPurchasesIdentity('reader')).resolves.toEqual({
      kind: 'active',
      store: 'STRIPE',
      expiresAt: '2027-11-10T12:00:00.000Z',
      willRenew: true,
      managementURL: 'https://billing.stripe.com/p/login/test',
    })
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'strp_sb_test', appUserId: 'reader' })
  })

  it('moves to another account without setting the SDK up again', async () => {
    await syncPurchasesIdentity('reader')
    await syncPurchasesIdentity('someone-else')
    expect(mockConfigure).toHaveBeenCalledTimes(1)
    expect(mockInstance.changeUser).toHaveBeenCalledWith('someone-else')
  })

  it('loads nothing and holds no Premium while nobody is signed in', async () => {
    await expect(syncPurchasesIdentity(null)).resolves.toEqual({ kind: 'none' })
    expect(mockConfigure).not.toHaveBeenCalled()
  })

  it('closes the SDK when the account signs out or stops seeing Premium', async () => {
    await syncPurchasesIdentity('reader')
    await releasePurchasesIdentity()
    expect(mockInstance.close).toHaveBeenCalled()
    await syncPurchasesIdentity('reader')
    expect(mockConfigure).toHaveBeenCalledTimes(2)
  })

  it('sells nothing without a key', async () => {
    mockApiKey = undefined
    await expect(syncPurchasesIdentity('reader')).resolves.toEqual({ kind: 'unknown' })
    expect(mockConfigure).not.toHaveBeenCalled()
  })
})

describe('the offer on the Web', () => {
  it('prices the plans in the app’s language', async () => {
    await syncPurchasesIdentity('reader')
    mockInstance.getOfferings.mockResolvedValue({
      current: {
        annual: webPackage('$rc_annual', 59_990_000),
        monthly: webPackage('$rc_monthly', 8_990_000),
      },
    })
    const offer = await loadPremiumOffer()
    const plain = (text?: string | null) => text?.replace(/\s/g, ' ')
    expect(offer.annual?.price).toBe(59.99)
    expect(plain(offer.annual?.priceString)).toBe('59,99 €')
    expect(plain(offer.annual?.pricePerMonthString)).toBe('4,99 €')
    expect(offer.monthly).toMatchObject({ price: 8.99, pricePerMonthString: null })
    expect(offer.savingsPercent).toBe(44)
  })
})

describe('buying on the Web', () => {
  beforeEach(async () => {
    await syncPurchasesIdentity('reader')
  })

  it('opens the checkout with the account’s address, in its language, without its success page', async () => {
    const listener = jest.fn()
    setPremiumListener(listener)
    mockInstance.purchase.mockResolvedValue({ customerInfo: premiumInfo })
    await expect(
      buyPremium(plan('$rc_annual'), { email: 'reader@example.com', language: 'en' })
    ).resolves.toBe('purchased')
    expect(mockInstance.purchase).toHaveBeenCalledWith(
      expect.objectContaining({
        rcPackage: expect.objectContaining({ identifier: '$rc_annual' }),
        customerEmail: 'reader@example.com',
        selectedLocale: 'en',
        skipSuccessPage: true,
        termsAndConditionsUrl: 'https://bible-strong.app/terms-en',
      })
    )
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'active' }))
  })

  it('asks for an address when RevenueCat refuses the account’s', async () => {
    mockInstance.purchase
      // The checkout's flow reports RevenueCat's refusal as an invalid purchase.
      .mockRejectedValueOnce(Object.assign(new Error('Email is not valid'), { errorCode: 4 }))
      .mockResolvedValueOnce({ customerInfo: premiumInfo })
    await expect(
      buyPremium(plan('$rc_annual'), { email: 'test@test.com', language: 'fr' })
    ).resolves.toBe('purchased')
    expect(mockInstance.purchase).toHaveBeenCalledTimes(2)
    expect(mockInstance.purchase.mock.calls[0][0]).toMatchObject({ customerEmail: 'test@test.com' })
    expect(mockInstance.purchase.mock.calls[1][0].customerEmail).toBeUndefined()
  })

  it('opens the checkout once more only when an address was given', async () => {
    mockInstance.purchase.mockRejectedValue(Object.assign(new Error('invalid'), { errorCode: 4 }))
    await expect(buyPremium(plan('$rc_annual'))).rejects.toThrow('invalid')
    expect(mockInstance.purchase).toHaveBeenCalledTimes(1)
  })

  it('loads the offer once the account’s setup has run', async () => {
    resetPurchasesClientForTests()
    mockInstance.getOfferings.mockResolvedValue({ current: null })
    const setup = syncPurchasesIdentity('reader')
    await expect(loadPremiumOffer()).resolves.toMatchObject({ savingsPercent: null })
    await setup
  })

  it('reports a closed checkout as cancelled', async () => {
    mockInstance.purchase.mockRejectedValue(Object.assign(new Error('closed'), { errorCode: 1 }))
    await expect(buyPremium(plan('$rc_monthly'))).resolves.toBe('cancelled')
  })

  it('reads Premium again when the account already holds it', async () => {
    mockInstance.purchase.mockRejectedValue(Object.assign(new Error('owned'), { errorCode: 6 }))
    mockInstance.getCustomerInfo.mockResolvedValue(premiumInfo)
    await expect(buyPremium(plan('$rc_monthly'))).resolves.toBe('purchased')
  })

  it('lets any other failure through', async () => {
    mockInstance.purchase.mockRejectedValue(Object.assign(new Error('card'), { errorCode: 2 }))
    await expect(buyPremium(plan('$rc_monthly'))).rejects.toThrow('card')
  })

  it('restores by reading Premium again, as no store keeps purchases here', async () => {
    mockInstance.getCustomerInfo.mockResolvedValue(premiumInfo)
    await expect(restorePremium()).resolves.toMatchObject({ kind: 'active', store: 'STRIPE' })
  })
})
