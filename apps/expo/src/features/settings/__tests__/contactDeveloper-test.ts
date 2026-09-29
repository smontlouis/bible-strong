import { buildSupportEmail, SUPPORT_EMAIL } from '../contactDeveloper'

describe('support email', () => {
  it('preserves accents, newlines and reserved URL characters in the composer', () => {
    const subject = '[Bible Strong] Idée & retour ?'
    const template = 'Bonjour,\n\nÉtapes : #1 + #2 & résultat'
    const email = buildSupportEmail(subject, template, 'Diagnostic', {
      firebaseUid: 'user-123',
      osVersion: '17.4',
      development: false,
      absent: undefined,
      empty: null,
    })
    const url = new URL(email.url)
    expect(url.pathname).toBe(SUPPORT_EMAIL)
    expect(url.searchParams.get('subject')).toBe(subject)
    expect(url.searchParams.get('body')).toBe(email.body)
    expect(email.body).toContain(template)
    expect(email.body).toContain('firebaseUid: user-123')
    expect(email.body).toContain('development: false')
    expect(email.body).not.toMatch(/undefined|null|absent:|empty:/)
    expect(email.text).toContain(SUPPORT_EMAIL)
    expect(email.text).toContain(email.body)
  })

  it('keeps a guest message usable without a Firebase or Sentry identifier', () => {
    const email = buildSupportEmail('Feedback', 'Hello', 'Diagnostics', { account: 'guest' })
    expect(email.body).toBe('Hello\n\n--- Diagnostics ---\naccount: guest')
  })
})
