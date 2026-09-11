import { analyticsRoute, createAnalyticsClient } from '../analyticsCore'

describe('analytics delivery', () => {
  it('preserves identity / event / logout order during asynchronous initialization', async () => {
    const calls: unknown[] = []
    const client = createAnalyticsClient(
      async () => ({
        identify: id => {
          calls.push(id)
        },
        event: name => {
          calls.push(name)
        },
      }),
      () => true,
      jest.fn()
    )
    void client.identify('account-id')
    void client.event('login')
    await client.identify(null)
    expect(calls).toEqual(['account-id', 'login', null])
  })

  it('recovers after a failed event without rejecting or preventing logout', async () => {
    const identify = jest.fn()
    const report = jest.fn()
    const client = createAnalyticsClient(
      async () => ({
        identify,
        event: () => {
          throw new Error('blocked')
        },
      }),
      () => true,
      report
    )
    await expect(client.event('page_view')).resolves.toBeUndefined()
    await client.identify(null)
    expect(report).toHaveBeenCalledTimes(1)
    expect(identify).toHaveBeenCalledWith(null)
  })

  it('does not initialize analytics when disabled', async () => {
    const load = jest.fn()
    await createAnalyticsClient(load, () => false, jest.fn()).event('login')
    expect(load).not.toHaveBeenCalled()
  })

  it('uses route templates instead of private document identifiers', () => {
    expect(analyticsRoute(['(app)', 'notes', '[id]'])).toEqual({
      path: '/notes/[id]',
      name: '[id]',
    })
  })
})
