import { describe, expect, it, vi } from 'vitest'
import { hostingerConfigured, sendHostingerNotification } from '../server/hostinger-mail'
import { notificationsConfigured } from '../server/guestbook-notifications'

const env = { HOSTINGER_MAIL_API_TOKEN: 'test-only-token', HOSTINGER_MAILBOX_ID: 'AC123' }
const mail = { to: 'admin@example.com', subject: 'Nouveau message', text: '<b>Texte brut</b>' }
const id = '01234567-1234-1234-1234-123456789abc'
describe('Hostinger notification transport', () => {
  it('requires credentials, a valid mailbox and an HTTPS admin link', () => {
    expect(hostingerConfigured(env)).toBe(true)
    expect(hostingerConfigured({ ...env, HOSTINGER_MAILBOX_ID: '../other' })).toBe(false)
    expect(notificationsConfigured(env)).toBe(false)
    const settings = {
      ...env,
      GUESTBOOK_NOTIFICATION_FROM: 'info@example.com',
      GUESTBOOK_NOTIFICATION_TO: mail.to,
    }
    expect(
      notificationsConfigured({
        ...settings,
        GUESTBOOK_ADMIN_URL: 'http://localhost/admin-guestbook',
      })
    ).toBe(false)
    expect(
      notificationsConfigured({
        ...settings,
        GUESTBOOK_ADMIN_URL: 'https://world.example.com/admin-guestbook',
      })
    ).toBe(true)
  })
  it('sends plain text to the configured recipient after checking Sent', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await sendHostingerNotification(id, mail, env, request)).toBe('sent')
    expect(request.mock.calls[0][0]).toContain('/folders/INBOX.Sent/messages/search')
    const [url, init] = request.mock.calls[1]
    expect(url).toBe('https://api.mail.hostinger.com/api/v1/mailboxes/AC123/send')
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-only-token')
    expect(JSON.parse(String(init?.body))).toEqual({
      to: [mail.to],
      displayName: 'Bible Strong World',
      subject: `${mail.subject} [guestbook:${id}]`,
      text: mail.text,
    })
  })
  it('recovers a lost acknowledgement without sending again', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: [{ uid: 42, subject: `${mail.subject} [guestbook:${id}]` }] })
      )
    expect(await sendHostingerNotification(id, mail, env, request)).toBe('sent')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('does not send when reconciliation fails or returns malformed data', async () => {
    for (const response of [
      new Response(null, { status: 401 }),
      Response.json({}),
      Response.json({ data: [{ uid: 1, subject: 'other' }] }),
      new Response('x'.repeat(65_537)),
    ]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response)
      expect(await sendHostingerNotification(id, mail, env, request)).toBe('failed')
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('keeps send errors and unexpected success responses retryable', async () => {
    for (const status of [200, 401, 429, 502, 504]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ data: [] }))
        .mockResolvedValueOnce(new Response(null, { status }))
      expect(await sendHostingerNotification(id, mail, env, request)).toBe('failed')
    }
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('network'))
    expect(await sendHostingerNotification(id, mail, env, request)).toBe('failed')
  })
})
