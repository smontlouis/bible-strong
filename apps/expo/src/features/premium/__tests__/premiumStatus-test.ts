import { toPremiumStatus, toWebPremiumStatus } from '../premiumStatus'

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

describe('toWebPremiumStatus', () => {
  it('reads Premium as the web SDK gives it: dates and lower-case stores', () => {
    expect(
      toWebPremiumStatus({
        entitlements: {
          active: {
            premium: {
              expirationDate: new Date('2027-11-10T12:00:00Z'),
              willRenew: false,
              store: 'stripe',
            },
          },
        },
        managementURL: 'https://billing.stripe.com/p/login/live',
      })
    ).toEqual({
      kind: 'active',
      store: 'STRIPE',
      expiresAt: '2027-11-10T12:00:00.000Z',
      willRenew: false,
      managementURL: 'https://billing.stripe.com/p/login/live',
    })
  })

  it('keeps a grant with no end, and holds nothing without the entitlement', () => {
    expect(
      toWebPremiumStatus({
        entitlements: {
          active: { premium: { expirationDate: null, willRenew: false, store: 'promotional' } },
        },
        managementURL: null,
      })
    ).toMatchObject({ kind: 'active', store: 'PROMOTIONAL', expiresAt: null })
    expect(toWebPremiumStatus({ entitlements: { active: {} }, managementURL: null })).toEqual({
      kind: 'none',
    })
  })
})
