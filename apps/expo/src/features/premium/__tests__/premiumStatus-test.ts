import { toPremiumStatus } from '../premiumStatus'

const entitlement = (overrides: Partial<{ store: string; willRenew: boolean }> = {}) => ({
  expirationDate: '2026-12-10T10:00:00Z',
  willRenew: true,
  store: 'APP_STORE',
  ...overrides,
})

describe('toPremiumStatus', () => {
  it('has no Premium without the premium entitlement', () => {
    expect(
      toPremiumStatus({ entitlements: { active: { other: entitlement() } }, managementURL: null })
    ).toEqual({ kind: 'none' })
  })

  it('reads the premium entitlement and the management link', () => {
    expect(
      toPremiumStatus({
        entitlements: { active: { premium: entitlement({ willRenew: false }) } },
        managementURL: 'https://apps.apple.com/account/subscriptions',
      })
    ).toEqual({
      kind: 'active',
      store: 'APP_STORE',
      expiresAt: '2026-12-10T10:00:00Z',
      willRenew: false,
      managementURL: 'https://apps.apple.com/account/subscriptions',
    })
  })

  it('names a store it does not know OTHER', () => {
    const status = toPremiumStatus({
      entitlements: { active: { premium: entitlement({ store: 'AMAZON' }) } },
      managementURL: null,
    })
    expect(status).toMatchObject({ kind: 'active', store: 'OTHER' })
  })

  it('keeps a grant from RevenueCat, such as a donor’s, as Premium', () => {
    const status = toPremiumStatus({
      entitlements: { active: { premium: entitlement({ store: 'PROMOTIONAL' }) } },
      managementURL: null,
    })
    expect(status).toMatchObject({ kind: 'active', store: 'PROMOTIONAL' })
  })
})
