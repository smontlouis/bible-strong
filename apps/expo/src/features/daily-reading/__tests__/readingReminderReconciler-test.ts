import {
  createReadingReminderQueue,
  reconcileReadingReminders,
  type ExistingReminder,
  type ReadingReminderDriver,
  type ReminderDelivery,
} from '../readingReminderReconciler'

const reminder = (
  owner = 'reader',
  overrides: Partial<ReminderDelivery> = {}
): ReminderDelivery => ({
  id: 'reading:daily:2026-09-15',
  timestamp: 1_789_455_600_000,
  title: 'Daily reading',
  body: 'Your reading is ready',
  data: { owner, kind: 'meditation', collectionId: 'book-a', date: '2026-09-15', scope: 'daily' },
  ...overrides,
})
const setup = (existing: ExistingReminder[] = []) => {
  const pending = new Map(existing.map(item => [item.id, item]))
  const driver: ReadingReminderDriver = {
    scheduled: jest.fn(async () => [...pending.values()]),
    displayed: jest.fn(async () => []),
    permission: jest.fn(async () => 'allowed'),
    cancelScheduled: jest.fn(async id => {
      pending.delete(id)
    }),
    removeDisplayed: jest.fn(async () => {}),
    schedule: jest.fn(async item => {
      pending.set(item.id, item)
    }),
  }
  return { driver, pending }
}

describe('reading reminder reconciliation', () => {
  it('keeps unchanged OS schedules rather than canceling and recreating them', async () => {
    const desired = reminder()
    const { driver } = setup([desired, { id: 'unrelated' }])
    const result = await reconcileReadingReminders(driver, [desired], 'reader', () => true)
    expect(driver.schedule).not.toHaveBeenCalled()
    expect(driver.cancelScheduled).not.toHaveBeenCalled()
    expect(result).toEqual({
      phase: 'scheduled',
      permission: 'allowed',
      through: { daily: '2026-09-15' },
    })
  })

  it('updates a changed source or time without touching unrelated notifications', async () => {
    const old = reminder()
    const next = reminder('reader', {
      timestamp: old.timestamp + 3_600_000,
      data: { ...old.data, collectionId: 'book-b' },
    })
    const { driver, pending } = setup([old, { id: 'other-reminder' }])
    await reconcileReadingReminders(driver, [next], 'reader', () => true)
    expect(driver.schedule).toHaveBeenCalledWith(next)
    expect(driver.cancelScheduled).not.toHaveBeenCalled()
    expect(pending.get(next.id)?.data?.collectionId).toBe('book-b')
    expect(pending.has('other-reminder')).toBe(true)
  })

  it('disabling cancels owned future reminders and explicit legacy-channel reminders only', async () => {
    const { driver, pending } = setup([
      reminder(),
      { id: 'old-vod', legacyDaily: true },
      { id: 'other-reminder' },
    ])
    await reconcileReadingReminders(driver, [], 'reader', () => true)
    expect([...pending.keys()]).toEqual(['other-reminder'])
    expect(driver.schedule).not.toHaveBeenCalled()
  })

  it('reports denied permission without prompting or claiming delivery', async () => {
    const { driver } = setup()
    jest.mocked(driver.permission).mockResolvedValue('denied')
    expect(await reconcileReadingReminders(driver, [reminder()], 'reader', () => true)).toEqual({
      phase: 'blocked',
      permission: 'denied',
      through: {},
    })
    expect(driver.schedule).not.toHaveBeenCalled()
  })

  it('removes old-owner destinations even if the next owner has the same notification ID', async () => {
    const old = reminder('old-owner')
    const { driver, pending } = setup([old])
    jest.mocked(driver.permission).mockResolvedValue('denied')
    await reconcileReadingReminders(driver, [reminder('new-owner')], 'new-owner', () => true)
    expect(pending.size).toBe(0)
    expect(driver.cancelScheduled).toHaveBeenCalledWith(old.id)
  })

  it('keeps same-owner delivered readings openable and removes another account’s displayed notifications', async () => {
    const { driver } = setup()
    jest.mocked(driver.displayed).mockResolvedValue([
      { id: 'reading:old-date', data: { owner: 'reader' } },
      { id: 'reading:private', data: { owner: 'other' } },
      { id: 'unrelated', data: { owner: 'other' } },
    ])
    await reconcileReadingReminders(driver, [], 'reader', () => true)
    expect(driver.removeDisplayed).toHaveBeenCalledTimes(1)
    expect(driver.removeDisplayed).toHaveBeenCalledWith('reading:private')
  })

  it('serializes an in-flight schedule with logout and removes its stale result', async () => {
    const { driver, pending } = setup()
    let release!: () => void
    let started!: () => void
    const entered = new Promise<void>(resolve => {
      started = resolve
    })
    const blocked = new Promise<void>(resolve => {
      release = resolve
    })
    jest.mocked(driver.schedule).mockImplementation(async item => {
      started()
      await blocked
      pending.set(item.id, item)
    })
    const queue = createReadingReminderQueue(driver)
    const first = queue.reconcile([reminder()], 'reader')
    await entered
    const logout = queue.reconcile([], '')
    release()
    expect((await first).phase).toBe('superseded')
    expect((await logout).phase).toBe('idle')
    expect(pending.size).toBe(0)
  })

  it('surfaces failures and lets a later retry repair the schedule', async () => {
    const { driver, pending } = setup()
    jest.mocked(driver.schedule).mockRejectedValueOnce(new Error('OS unavailable'))
    const queue = createReadingReminderQueue(driver)
    await expect(queue.reconcile([reminder()], 'reader')).rejects.toThrow('OS unavailable')
    expect((await queue.reconcile([reminder()], 'reader')).phase).toBe('scheduled')
    expect(pending.size).toBe(1)
  })
})
