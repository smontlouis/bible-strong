jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => ({ uid: 'reader' }) }))
jest.mock('../call', () => ({ call: jest.fn() }))

import {
  readingReminderInbox,
  subscribeReadingReminderClicks,
  takeReadingReminderUrl,
} from '../readingReminders'

/** The address `reminder_url` writes in `reminders.rs`: form-encoded JSON, spaces as `+`. */
const reminderUrl = (reminder: object) =>
  `biblestrong://reading-reminder?payload=${encodeURIComponent(JSON.stringify(reminder)).replace(/%20/g, '+')}`

const meditation = {
  id: 'reading:daily:2026-11-27',
  timestamp: 1_795_766_400_000,
  title: 'Lecture du jour',
  body: 'Ta méditation t’attend',
  data: { kind: 'meditation', collectionId: 'abc', date: '2026-11-27', owner: 'reader' },
}

describe('a clicked reading reminder on the desktop app', () => {
  it('opens the reading it announced, once', () => {
    const clicked = jest.fn()
    const unsubscribe = subscribeReadingReminderClicks(clicked)
    expect(takeReadingReminderUrl(reminderUrl(meditation))).toBe(true)
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(readingReminderInbox.consume('reader')).toEqual({
      pathname: '/meditation',
      params: { collectionId: 'abc', date: '2026-11-27' },
    })
    expect(readingReminderInbox.consume('reader')).toBeUndefined()
    unsubscribe()
  })

  it('opens nothing for another account', () => {
    takeReadingReminderUrl(reminderUrl({ ...meditation, id: 'reading:daily:2026-11-28' }))
    expect(readingReminderInbox.consume('someone-else')).toBeUndefined()
  })

  it('leaves other addresses to the routes', () => {
    expect(takeReadingReminderUrl('biblestrong://bible/LSG/JHN/3')).toBe(false)
    expect(takeReadingReminderUrl('biblestrong://reading-reminder?payload=nope')).toBe(true)
  })
})
