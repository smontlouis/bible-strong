jest.mock('~helpers/assistantConsentFirestore', () => ({
  observeAssistantConsent: jest.fn(),
  saveAssistantConsent: jest.fn(),
  deleteAssistantConsent: jest.fn(),
}))

import { AI_CONSENT_VERSION, consentStatusOf } from '../aiConsent'

describe('consentStatusOf', () => {
  it('asks when nothing is stored', () => {
    expect(consentStatusOf(null)).toBe('missing')
    expect(consentStatusOf(undefined)).toBe('missing')
    expect(consentStatusOf({})).toBe('missing')
  })

  it('accepts an agreement to the current text or a later one', () => {
    expect(consentStatusOf({ version: AI_CONSENT_VERSION, acceptedAt: 1 })).toBe('granted')
    expect(consentStatusOf({ version: AI_CONSENT_VERSION + 1 })).toBe('granted')
  })

  it('asks again after the text changed', () => {
    expect(consentStatusOf({ version: AI_CONSENT_VERSION - 1 })).toBe('missing')
    expect(consentStatusOf({ version: String(AI_CONSENT_VERSION) })).toBe('missing')
  })
})
