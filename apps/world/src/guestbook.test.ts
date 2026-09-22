import { defaultNavigation } from './world'
import { describe, expect, it } from 'vitest'
import { nearGuestbook, parseSubmission } from './guestbook'
import { moderateGuestbook } from '../server/guestbook-moderation'
const submission = {
  id: 'ad46fd22-99eb-41a0-a4f3-80aba0aef7bf',
  profile: { name: 'Alice', avatar: 'nova' as const, color: '#73cdd0' },
  message: 'Merci pour cette découverte !',
}
const answers = (risk = 0.01) => ({
  answers: Object.fromEntries(
    ['abuse', 'vulgarity', 'explicit', 'spam', 'privacy'].map(name => [
      name,
      { type: 'boolean', probability: risk },
    ])
  ),
})
describe('guestbook admission', () => {
  it('offers the book throughout the central island, excluding bridges and other islands', () => {
    expect(nearGuestbook({ x: 836, y: 542 })).toBe(true)
    expect(nearGuestbook({ x: 620, y: 445 })).toBe(true)
    expect(nearGuestbook({ x: 1040, y: 465 })).toBe(true)
    expect(nearGuestbook({ x: 836, y: 315 })).toBe(false)
    expect(nearGuestbook({ x: 965, y: 470 })).toBe(true)
    expect(nearGuestbook({ x: 836, y: 590 })).toBe(false)
    expect(nearGuestbook({ x: 790, y: 259 })).toBe(false)
  })
  it('uses the edited central island contour', () => {
    const navigation = {
      ...defaultNavigation,
      zones: [
        {
          id: 'land-0',
          name: 'Place',
          kind: 'allowed' as const,
          points: [
            [800, 400],
            [900, 400],
            [900, 500],
            [800, 500],
          ] as const,
        },
      ],
    }
    expect(nearGuestbook({ x: 836, y: 465 }, navigation)).toBe(true)
    expect(nearGuestbook({ x: 620, y: 445 }, navigation)).toBe(false)
    expect(nearGuestbook({ x: 836, y: 465 }, { ...navigation, zones: [] })).toBe(false)
  })
  it('rejects empty, oversized and malformed submissions before moderation', () => {
    expect(parseSubmission(submission)).toEqual(submission)
    for (const message of ['', '   ', 'x'.repeat(501), 'hello\u0000'])
      expect(parseSubmission({ ...submission, message })).toBeNull()
    expect(
      parseSubmission({ ...submission, profile: { ...submission.profile, color: 'url(evil)' } })
    ).toBeNull()
  })
  it('validates note colors independently of avatar colors', () => {
    expect(parseSubmission({ ...submission, noteColor: 'mint' })?.noteColor).toBe('mint')
    expect(parseSubmission({ ...submission, noteColor: 'url(evil)' })).toBeNull()
  })
  it('sends both the name and message to Jev without exposing the key in the body', async () => {
    const mock: typeof fetch = async (_, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.state).toEqual({ name: submission.profile.name, message: submission.message })
      expect(String(init?.body)).not.toContain('private-key')
      expect(new Headers(init?.headers).get('ai-model-id')).toBe('typesafe-ai/jev')
      return Response.json(answers())
    }
    expect(await moderateGuestbook(submission, 'private-key', mock)).toBe('accepted')
  })
  it('rejects any risky category at the boundary', async () => {
    const data = answers()
    data.answers.privacy.probability = 0.35
    expect(await moderateGuestbook(submission, 'key', async () => Response.json(data))).toBe(
      'rejected'
    )
  })
  it('rejects isolated profanity even when Jev sees no targeted abuse', async () => {
    const data = answers()
    data.answers.vulgarity.probability = 0.9
    expect(
      await moderateGuestbook({ ...submission, message: 'Sale merde !' }, 'key', async () =>
        Response.json(data)
      )
    ).toBe('rejected')
  })
  it('fails closed on missing keys, network failure, malformed or incomplete decisions', async () => {
    expect(await moderateGuestbook(submission)).toBe('unavailable')
    expect(
      await moderateGuestbook(submission, 'key', async () => {
        throw new Error('offline')
      })
    ).toBe('unavailable')
    for (const body of [
      {},
      { answers: {} },
      { answers: { ...answers().answers, abuse: { type: 'boolean', probability: 2 } } },
      { answers: { ...answers().answers, spam: { type: 'choice', choice: 'safe' } } },
    ]) {
      expect(await moderateGuestbook(submission, 'key', async () => Response.json(body))).toBe(
        'unavailable'
      )
    }
    expect(
      await moderateGuestbook(submission, 'key', async () => new Response('', { status: 503 }))
    ).toBe('unavailable')
  })
})
