import { openUrl } from '@tauri-apps/plugin-opener'

import type { PremiumOfferPlan } from '../premiumOffer'
import { buyPremium, isPurchasesAvailable, purchaseLinkUrl } from '../purchasesClient.desktop'

let mockLink: string | undefined = 'https://pay.rev.cat/sandbox/token/'
let mockUserId: string | null = 'reader'
const mockExpect = jest.fn()

jest.mock('@tauri-apps/plugin-opener', () => ({ openUrl: jest.fn(() => Promise.resolve()) }))

jest.mock('../premiumConfig', () => ({
  revenueCatApiKey: () => 'strp_sb_test',
  revenueCatPurchaseLink: () => mockLink,
}))

jest.mock('../purchasesClient.web', () => ({
  expectPremiumChange: () => mockExpect(),
  packageIdentifier: (plan: { package: { identifier: string } }) => plan.package.identifier,
  purchasesUserId: () => mockUserId,
}))

const plan = (identifier: string) => ({ package: { identifier } }) as unknown as PremiumOfferPlan

beforeEach(() => {
  jest.clearAllMocks()
  mockLink = 'https://pay.rev.cat/sandbox/token/'
  mockUserId = 'reader'
})

describe('the purchase link of the desktop app', () => {
  it('carries the account, the plan and the address', () => {
    expect(
      purchaseLinkUrl('https://pay.rev.cat/token/', 'uid/1', plan('$rc_annual'), {
        email: 'a+b@example.com',
        language: 'fr',
      })
    ).toBe('https://pay.rev.cat/token/uid%2F1?package_id=%24rc_annual&email=a%2Bb%40example.com')
  })

  it('accepts a link written without its last slash', () => {
    expect(purchaseLinkUrl('https://pay.rev.cat/token', 'reader', plan('$rc_monthly'))).toBe(
      'https://pay.rev.cat/token/reader?package_id=%24rc_monthly'
    )
  })

  it('opens the checkout in the browser and waits for Premium to come back', async () => {
    await expect(buyPremium(plan('$rc_annual'))).resolves.toBe('pending')
    expect(openUrl).toHaveBeenCalledWith(
      'https://pay.rev.cat/sandbox/token/reader?package_id=%24rc_annual'
    )
    expect(mockExpect).toHaveBeenCalled()
  })

  it('opens nothing before RevenueCat follows an account', async () => {
    mockUserId = null
    await expect(buyPremium(plan('$rc_annual'))).rejects.toThrow('PREMIUM_NOT_CONFIGURED')
    expect(openUrl).not.toHaveBeenCalled()
  })

  it('sells nothing without a purchase link', () => {
    expect(isPurchasesAvailable()).toBe(true)
    mockLink = undefined
    expect(isPurchasesAvailable()).toBe(false)
  })
})
