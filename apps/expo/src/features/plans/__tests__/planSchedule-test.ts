import {
  getDoneDays,
  getMissedDays,
  getParticipationJourney,
  getPlanCurrentDay,
  getPlanDayState,
  getPlanJourney,
  getPlanStreak,
} from '../planSchedule'

const days = (pattern: string) => [...pattern].map(day => day === 'x')

it('reads the days done from a participation or from computed statuses', () => {
  const readings = [{ id: 'a' }, { id: 'b', status: 'Completed' }]
  expect(getDoneDays(readings, { a: 'Completed' })).toEqual([true, false])
  expect(getDoneDays(readings)).toEqual([false, true])
})

it('places each day against today', () => {
  const done = days('x.x..')
  expect([1, 2, 3, 4, 5].map(day => getPlanDayState(done, day, 4))).toEqual([
    'read',
    'missed',
    'read',
    'today',
    'upcoming',
  ])
  expect(getPlanDayState(done, 2)).toBe('upcoming')
})

it('stays on today while the calendar runs, whatever is left behind', () => {
  expect(getPlanCurrentDay(days('.....'), 4)).toBe(4)
  // Before the start, day one; once the calendar is over or without one, the first gap.
  expect(getPlanCurrentDay(days('.....'), -2)).toBe(1)
  expect(getPlanCurrentDay(days('xx.x.'), 9)).toBe(3)
  expect(getPlanCurrentDay(days('xx.x.'))).toBe(3)
  expect(getPlanCurrentDay(days('xxxxx'))).toBe(5)
})

it('lists the days of the calendar left behind', () => {
  expect(getMissedDays(days('x.x..'), 4)).toEqual([2])
  expect(getMissedDays(days('x.x..'), 9)).toEqual([2, 4, 5])
  expect(getMissedDays(days('x.x..'))).toEqual([])
})

it('counts the days read in a row up to today, or up to yesterday while today is to read', () => {
  expect(getPlanStreak(days('.xxx..'), 4)).toBe(3)
  expect(getPlanStreak(days('.xx...'), 4)).toBe(2)
  expect(getPlanStreak(days('xx.x..'), 5)).toBe(1)
  expect(getPlanStreak(days('xx....'), 5)).toBe(0)
  expect(getPlanStreak(days('xxx'))).toBe(0)
  // After the calendar: alive the day after its last day, gone after that or if it was missed.
  expect(getPlanStreak(days('xxx'), 4)).toBe(3)
  expect(getPlanStreak(days('xxx'), 8)).toBe(0)
  expect(getPlanStreak(days('xxx.'), 5)).toBe(0)
})

it('leads « Continuer » to today, then to a day left behind, then to reading again', () => {
  expect(getPlanJourney(days('x....'), '2026-09-10', '2026-09-13')).toMatchObject({
    today: 4,
    currentDay: 4,
    missed: [2, 3],
    continueDay: 4,
    continueKind: 'continue',
  })
  expect(getPlanJourney(days('x..x.'), '2026-09-10', '2026-09-13')).toMatchObject({
    continueDay: 2,
    continueKind: 'catchUp',
    streak: 1,
  })
  expect(getPlanJourney(days('xxxx.'), '2026-09-10', '2026-09-13')).toMatchObject({
    continueDay: 4,
    continueKind: 'reread',
    streak: 4,
    finished: false,
  })
})

it('follows a plan without a calendar from its first gap', () => {
  const journey = getParticipationJourney(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    { readingSlices: { a: 'Completed', c: 'Completed' } },
    '2026-09-13'
  )
  expect(journey).toMatchObject({
    today: undefined,
    currentDay: 2,
    missed: [],
    streak: 0,
    completed: 2,
    continueKind: 'continue',
  })
})
