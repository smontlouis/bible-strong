import type { AssistantOpening } from '~helpers/assistantOpening'

import { premiumVisible } from '../premiumVisibility'

let mockChannel = 'app_store'
let mockAvailable = true
jest.mock('../salesChannel', () => ({ salesChannel: () => mockChannel }))
jest.mock('../purchasesClient', () => ({ isPurchasesAvailable: () => mockAvailable }))
jest.mock('~helpers/useLogin', () => () => ({ isLogged: false, user: {} }))

const tester = 'p0VPP67AxSRp98KKWMWl2wWhBMP2'
const other = 'Anr64tUdQKYKtskaluahn2Pecg22'
const closed: AssistantOpening = { open: false, betaUids: new Set([tester]) }
const open: AssistantOpening = { open: true, betaUids: new Set() }

beforeEach(() => {
  mockChannel = 'app_store'
  mockAvailable = true
})

it('shows Premium only to the beta list until the assistant opens', () => {
  expect(premiumVisible(closed, tester)).toBe(true)
  expect(premiumVisible(closed, other)).toBe(false)
  expect(premiumVisible(closed, null)).toBe(false)
})

it('shows Premium to every signed-in account once the assistant is open', () => {
  expect(premiumVisible(open, other)).toBe(true)
  expect(premiumVisible(open, null)).toBe(false)
})

it('shows Premium only where this surface sells it', () => {
  mockChannel = 'none'
  expect(premiumVisible(open, tester)).toBe(false)
  mockChannel = 'play_store'
  mockAvailable = false
  expect(premiumVisible(open, tester)).toBe(false)
})
