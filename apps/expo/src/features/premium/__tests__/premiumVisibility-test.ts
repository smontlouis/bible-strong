import { premiumVisible } from '../premiumVisibility'

let mockChannel = 'app_store'
let mockAvailable = true
jest.mock('../salesChannel', () => ({ salesChannel: () => mockChannel }))
jest.mock('../purchasesClient', () => ({ isPurchasesAvailable: () => mockAvailable }))
jest.mock('~helpers/useLogin', () => () => ({ isLogged: false, user: {} }))
jest.mock('~helpers/betaAccess', () => ({
  hasBetaAccess: (uid?: string | null) => uid === 'p0VPP67AxSRp98KKWMWl2wWhBMP2',
}))

beforeEach(() => {
  mockChannel = 'app_store'
  mockAvailable = true
})

it('shows Premium only to the beta list, where this surface sells it', () => {
  expect(premiumVisible('p0VPP67AxSRp98KKWMWl2wWhBMP2')).toBe(true)
  expect(premiumVisible('Anr64tUdQKYKtskaluahn2Pecg22')).toBe(false)
  expect(premiumVisible(null)).toBe(false)
  mockChannel = 'none'
  expect(premiumVisible('p0VPP67AxSRp98KKWMWl2wWhBMP2')).toBe(false)
  mockChannel = 'play_store'
  mockAvailable = false
  expect(premiumVisible('p0VPP67AxSRp98KKWMWl2wWhBMP2')).toBe(false)
})
