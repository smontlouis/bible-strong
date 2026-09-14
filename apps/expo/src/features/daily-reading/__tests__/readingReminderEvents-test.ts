import { createReadingReminderInbox, readReminderPress } from '../readingReminderEvents'

const storage = () => {
  const data = new Map<string, string>()
  return {
    getString: (key: string) => data.get(key),
    set: (key: string, value: string) => {
      data.set(key, value)
    },
    remove: (key: string) => {
      data.delete(key)
    },
  }
}
const data = {
  owner: 'reader',
  kind: 'meditation',
  collectionId: 'original-source',
  date: '2026-09-14',
  deliveryAt: '1789364000000',
}

describe('reading reminder presses', () => {
  it('persists a background press until the UI is available, retaining its source and date', () => {
    const disk = storage()
    createReadingReminderInbox(disk).remember('reading:daily:2026-09-14', data)
    const foreground = createReadingReminderInbox(disk)
    expect(foreground.consume('reader')).toEqual({
      pathname: '/meditation',
      params: { collectionId: 'original-source', date: '2026-09-14' },
    })
    expect(foreground.consume('reader')).toBeUndefined()
  })

  it('deduplicates initial and foreground delivery of the same press', () => {
    const inbox = createReadingReminderInbox(storage())
    inbox.remember('reading:daily:2026-09-14', data)
    expect(inbox.consume('reader')).toBeDefined()
    inbox.remember('reading:daily:2026-09-14', data)
    expect(inbox.consume('reader')).toBeUndefined()
    inbox.remember('reading:daily:2026-09-14', {
      ...data,
      collectionId: 'different-source',
      deliveryAt: '1789368000000',
    })
    expect(inbox.consume('reader')?.params).toMatchObject({ collectionId: 'different-source' })
  })

  it('discards another account’s notification instead of opening it after logout', () => {
    const inbox = createReadingReminderInbox(storage())
    inbox.remember('reading:daily:2026-09-14', data)
    expect(inbox.consume('')).toBeUndefined()
    expect(inbox.consume('reader')).toBeUndefined()
  })

  it('opens the original standalone verse even if a collection is now selected', () => {
    const inbox = createReadingReminderInbox(storage())
    inbox.remember('reading:daily:2026-09-14', {
      owner: 'reader',
      kind: 'verse',
      date: '2026-09-14',
    })
    expect(inbox.consume('reader')).toEqual({
      pathname: '/daily-verse',
      params: { date: '2026-09-14' },
    })
  })

  it('opens the exact scheduled plan day', () => {
    const inbox = createReadingReminderInbox(storage())
    inbox.remember('reading:plan:p:2026-09-14', {
      owner: 'reader',
      kind: 'plan',
      planId: 'p',
      date: '2026-09-14',
    })
    expect(inbox.consume('reader')).toEqual({
      pathname: '/plan',
      params: { planId: 'p', date: '2026-09-14' },
    })
  })

  it.each([
    { ...data, date: '2026-02-30' },
    { ...data, collectionId: '' },
    { ...data, owner: null },
    { ...data, kind: 'url', url: 'https://example.com' },
    null,
  ])('rejects malformed notification data %j', value => {
    expect(readReminderPress('reading:daily:2026-09-14', value)).toBeUndefined()
  })

  it('ignores unrelated notifications and corrupted local inbox data', () => {
    expect(readReminderPress('other-notification', data)).toBeUndefined()
    const disk = storage()
    disk.set('pending', 'broken-json')
    expect(createReadingReminderInbox(disk).consume('reader')).toBeUndefined()
    expect(disk.getString('pending')).toBeUndefined()
  })
})
