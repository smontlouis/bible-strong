import type { Plan } from '~common/types'
import { buildReadingReminderSchedule } from '../readingReminderSchedule'

const plan: Plan = {
  id: 'plan',
  title: 'A journey',
  lang: 'fr',
  type: 'yearly',
  author: { id: 'author', displayName: 'Author', photoUrl: '' },
  sections: [
    {
      id: 'section',
      title: 'Readings',
      subTitle: '',
      readingSlices: [
        { id: 'a', slices: [] },
        { id: 'b', slices: [] },
        { id: 'c', slices: [] },
      ],
    },
  ],
}
const collection: Plan = {
  ...plan,
  id: 'collection',
  type: 'meditation',
  sections: [
    {
      id: 'feb',
      title: 'February',
      subTitle: '',
      readingSlices: [{ id: 'feb-28', title: 'Hope, February 28', slices: [] }],
    },
  ],
}

describe('reading reminder scheduling', () => {
  it('does not backdate today’s reminder and carries the exact date and owner', () => {
    const schedule = buildReadingReminderSchedule({
      time: '08:30',
      owner: 'reader',
      plans: [],
      ongoing: [],
      now: new Date(2026, 8, 14, 9),
      days: 2,
    })
    expect(schedule).toHaveLength(1)
    expect(schedule[0].timestamp).toBe(new Date(2026, 8, 15, 8, 30).getTime())
    expect(schedule[0].data).toMatchObject({ kind: 'verse', date: '2026-09-15', owner: 'reader' })
  })

  it('uses the selected collection and skips a missing leap-day entry', () => {
    const schedule = buildReadingReminderSchedule({
      time: '08:30',
      sourceId: collection.id,
      owner: '',
      plans: [collection],
      ongoing: [],
      now: new Date(2024, 1, 28, 7),
      days: 2,
    })
    expect(schedule).toHaveLength(1)
    expect(schedule[0].data).toMatchObject({
      kind: 'meditation',
      collectionId: collection.id,
      date: '2024-02-28',
      owner: '',
    })
  })

  it('does not move the plan schedule to compensate for a missed day', () => {
    const schedule = buildReadingReminderSchedule({
      owner: 'reader',
      plans: [plan],
      ongoing: [
        {
          id: plan.id,
          status: 'Progress',
          startDate: '2026-09-14',
          reminderTime: '08:30',
          readingSlices: { b: 'Completed' },
        },
      ],
      now: new Date(2026, 8, 15, 7),
      days: 3,
    })
    expect(schedule.map(item => item.data.date)).toEqual(['2026-09-16'])
  })

  it('keeps independent daily and plan reminders while bounding the closest notifications', () => {
    const schedule = buildReadingReminderSchedule({
      owner: '',
      time: '20:00',
      plans: [plan],
      ongoing: [
        {
          id: plan.id,
          status: 'Progress',
          startDate: '2026-09-14',
          reminderTime: '08:30',
          readingSlices: {},
        },
      ],
      now: new Date(2026, 8, 14, 7),
      days: 3,
      limit: 2,
    })
    expect(schedule.map(item => item.data.kind)).toEqual(['plan', 'verse'])
    expect(new Set(schedule.map(item => item.id)).size).toBe(2)
  })

  it('does not schedule disabled, invalid-time or completed-plan reminders', () => {
    expect(
      buildReadingReminderSchedule({
        owner: '',
        time: '99:99',
        plans: [plan],
        ongoing: [
          {
            id: plan.id,
            status: 'Completed',
            startDate: '2026-09-14',
            reminderTime: '08:30',
            readingSlices: {},
          },
        ],
        now: new Date(2026, 8, 14, 7),
      })
    ).toEqual([])
  })
})
