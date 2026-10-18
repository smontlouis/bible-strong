import type { OngoingPlan, Plan, ReadingSlice, Section } from '~common/types'
import {
  areOngoingPlansEqual,
  buildComputedPlan,
  buildComputedPlanItem,
  calculateReadingProgress,
  markReadingSliceAsRead,
  hasPlanParticipation,
  canUpdatePlanProgress,
  getReadEntitySliceKeys,
  getReadableEntitySliceKeys,
  getPlanDayStep,
  setEntitySliceRead,
} from '../planProgress'

const createReadingSlice = (id: string): ReadingSlice => ({
  id,
  slices: [{ type: 'Verse', id: '1-1-1', verses: 'Gen 1:1' }],
})

const createSection = (id: string, readingSlices: ReadingSlice[]): Section => ({
  id,
  title: `Section ${id}`,
  subTitle: 'Subtitle',
  readingSlices,
})

const createPlan = (id: string, sections: Section[]): Plan => ({
  id,
  title: `Plan ${id}`,
  description: 'Test plan',
  author: { id: 'author-1', displayName: 'Author', photoUrl: '' },
  sections,
  lastUpdate: 1,
  type: 'yearly',
  lang: 'fr',
})

describe('planProgress', () => {
  describe('calculateReadingProgress', () => {
    it('calculates completed Plan slice progress', () => {
      const readingSlices = [
        createReadingSlice('slice-1'),
        createReadingSlice('slice-2'),
        createReadingSlice('slice-3'),
      ]

      expect(
        calculateReadingProgress(readingSlices, [
          { id: 'slice-1', status: 'Completed' },
          { id: 'slice-2', status: 'Next' },
        ])
      ).toBe(1 / 3)
    })

    it('returns zero when a Reading plan has no slices', () => {
      expect(calculateReadingProgress([], [{ id: 'slice-1', status: 'Completed' }])).toBe(0)
    })
  })

  describe('buildComputedPlan', () => {
    it('builds section and Plan slice progress through one Interface', () => {
      const plan = createPlan('plan-1', [
        createSection('section-1', [createReadingSlice('slice-1'), createReadingSlice('slice-2')]),
        createSection('section-2', [createReadingSlice('slice-3')]),
      ])
      const ongoingPlan: OngoingPlan = {
        id: 'plan-1',
        status: 'Progress',
        readingSlices: {
          'slice-1': 'Completed',
          'slice-2': 'Next',
        },
      }

      const computedPlan = buildComputedPlan(plan, ongoingPlan)

      expect(computedPlan.status).toBe('Progress')
      expect(computedPlan.progress).toBe(1 / 3)
      expect(computedPlan.sections[0].progress).toBe(1 / 2)
      expect(computedPlan.sections[0].data[0].status).toBe('Completed')
      expect(computedPlan.sections[0].data[1].status).toBe('Next')
      expect(computedPlan.sections[1].data[0].status).toBe('Idle')
    })
  })

  describe('buildComputedPlanItem', () => {
    it('omits sections while preserving Reading plan progress', () => {
      const plan = createPlan('plan-1', [
        createSection('section-1', [createReadingSlice('slice-1'), createReadingSlice('slice-2')]),
      ])
      const computedPlanItem = buildComputedPlanItem(plan, {
        id: 'plan-1',
        status: 'Progress',
        readingSlices: {
          'slice-1': 'Completed',
        },
      })

      expect('sections' in computedPlanItem).toBe(false)
      expect(computedPlanItem.progress).toBe(1 / 2)
      expect(computedPlanItem.status).toBe('Progress')
    })
  })

  describe('areOngoingPlansEqual', () => {
    it('detects Plan slice status changes inside object-shaped readingSlices', () => {
      const prev: OngoingPlan[] = [
        {
          id: 'plan-1',
          status: 'Progress',
          readingSlices: {
            'slice-1': 'Completed',
          },
        },
      ]
      const next: OngoingPlan[] = [
        {
          id: 'plan-1',
          status: 'Progress',
          readingSlices: {
            'slice-1': 'Completed',
            'slice-2': 'Next',
          },
        },
      ]

      expect(areOngoingPlansEqual(prev, next)).toBe(false)
    })

    it('treats equivalent ongoing Reading plan state as equal', () => {
      const prev: OngoingPlan[] = [
        {
          id: 'plan-1',
          status: 'Progress',
          readingSlices: {
            'slice-1': 'Completed',
            'slice-2': 'Next',
          },
        },
      ]
      const next: OngoingPlan[] = [
        {
          id: 'plan-1',
          status: 'Progress',
          readingSlices: {
            'slice-2': 'Next',
            'slice-1': 'Completed',
          },
        },
      ]

      expect(areOngoingPlansEqual(prev, next)).toBe(true)
    })
  })

  describe('markReadingSliceAsRead', () => {
    it('completes a Plan slice and marks the next Plan slice', () => {
      const plan = createPlan('plan-1', [
        createSection('section-1', [createReadingSlice('slice-1'), createReadingSlice('slice-2')]),
      ])

      const ongoingPlans = markReadingSliceAsRead({
        ongoingPlans: [{ id: 'plan-1', status: 'Progress', readingSlices: {} }],
        plan,
        planId: 'plan-1',
        readingSliceId: 'slice-1',
      })

      expect(ongoingPlans[0]).toEqual({
        id: 'plan-1',
        status: 'Progress',
        readingSlices: {
          'slice-1': 'Completed',
          'slice-2': 'Next',
        },
      })
    })

    it('sets the Reading plan to Completed when every Plan slice is completed', () => {
      const plan = createPlan('plan-1', [
        createSection('section-1', [createReadingSlice('slice-1')]),
      ])

      const ongoingPlans = markReadingSliceAsRead({
        ongoingPlans: [{ id: 'plan-1', status: 'Progress', readingSlices: {} }],
        plan,
        planId: 'plan-1',
        readingSliceId: 'slice-1',
      })

      expect(ongoingPlans[0].status).toBe('Completed')
    })

    it('preserves other active plans when reading a different plan', () => {
      const plan = createPlan('plan-2', [
        createSection('section-1', [createReadingSlice('slice-2')]),
      ])

      const ongoingPlans = markReadingSliceAsRead({
        ongoingPlans: [
          { id: 'plan-2', status: 'Progress', readingSlices: {} },
          {
            id: 'plan-1',
            status: 'Progress',
            readingSlices: {},
          },
        ],
        plan,
        planId: 'plan-2',
        readingSliceId: 'slice-2',
      })

      expect(ongoingPlans.find(ongoingPlan => ongoingPlan.id === 'plan-1')?.status).toBe('Progress')
      expect(ongoingPlans.find(ongoingPlan => ongoingPlan.id === 'plan-2')?.status).toBe(
        'Completed'
      )
    })
  })
})

describe('participation boundary', () => {
  const plan = createPlan('reading-plan', [createSection('section', [createReadingSlice('a')])])
  const download: OngoingPlan = { id: plan.id, status: 'Idle', readingSlices: {} }

  it('does not turn a cached preview or old empty download into participation', () => {
    expect(hasPlanParticipation(undefined)).toBe(false)
    expect(hasPlanParticipation(download)).toBe(false)
    for (const records of [[], [download]]) {
      expect(
        markReadingSliceAsRead({
          ongoingPlans: records,
          plan,
          planId: plan.id,
          readingSliceId: 'a',
        })
      ).toBe(records)
    }
  })

  it('keeps undated legacy progress resumable without assigning a start date', () => {
    const legacy: OngoingPlan = { ...download, readingSlices: { a: 'Completed' } }
    expect(hasPlanParticipation(legacy)).toBe(true)
    expect(canUpdatePlanProgress(plan, legacy)).toBe(true)
    const result = markReadingSliceAsRead({
      ongoingPlans: [legacy],
      plan,
      planId: plan.id,
      readingSliceId: 'a',
    })
    expect(result[0].readingSlices.a).toBe('Next')
    expect(result[0].startDate).toBeUndefined()
  })

  it('does not write new undated meditation history through a legacy plan action', () => {
    const legacy: OngoingPlan = { ...download, readingSlices: { a: 'Completed' } }
    expect(canUpdatePlanProgress({ ...plan, kind: 'daily-meditation' }, legacy)).toBe(false)
    const records = [legacy]
    expect(
      markReadingSliceAsRead({
        ongoingPlans: records,
        plan: { ...plan, kind: 'daily-meditation' },
        planId: plan.id,
        readingSliceId: 'a',
      })
    ).toBe(records)
  })

  it('ignores invalid reading IDs and does not let orphaned legacy IDs prevent completion', () => {
    const existing: OngoingPlan = {
      ...download,
      status: 'Progress',
      readingSlices: { orphaned: 'Completed' },
    }
    const records = [existing]
    expect(
      markReadingSliceAsRead({
        ongoingPlans: records,
        plan,
        planId: plan.id,
        readingSliceId: 'unknown',
      })
    ).toBe(records)
    const result = markReadingSliceAsRead({
      ongoingPlans: records,
      plan,
      planId: plan.id,
      readingSliceId: 'a',
    })
    expect(result[0].status).toBe('Completed')
    expect(result[0].readingSlices.orphaned).toBe('Completed')
  })
})

describe('element progress', () => {
  const day = (id: string): ReadingSlice => ({
    id,
    slices: [
      { type: 'Title', id: `${id}-title`, title: 'Lecture' },
      { type: 'Chapter', id: `${id}-a`, chapters: '1|1-3' },
      { type: 'Verse', verses: '13|1:1-4' },
      { type: 'Video', id: `${id}-c`, title: 'Vidéo', url: 'https://example.com/video' },
    ],
  })
  const plan: Plan = {
    ...createPlan('plan-1', [createSection('section-1', [day('day-1'), day('day-2')])]),
    type: 'reading-plan',
  }
  const started: OngoingPlan[] = [
    { id: 'plan-1', status: 'Progress', readingSlices: {}, startDate: '2026-10-11' },
  ]
  const read = (ongoingPlans: OngoingPlan[], entitySliceId: string, readingSliceId = 'day-1') =>
    setEntitySliceRead({
      ongoingPlans,
      plan,
      planId: 'plan-1',
      readingSliceId,
      entitySliceId,
      read: true,
    })
  const unread = (ongoingPlans: OngoingPlan[], entitySliceId: string) =>
    setEntitySliceRead({
      ongoingPlans,
      plan,
      planId: 'plan-1',
      readingSliceId: 'day-1',
      entitySliceId,
      read: false,
    })

  it('counts readable elements only and identifies an element without id by its place', () => {
    expect(getReadableEntitySliceKeys(day('day-1'))).toEqual(['day-1-a', 'day-1:2', 'day-1-c'])
  })

  it('records a read element once without completing the day', () => {
    const once = read(started, 'day-1-a')
    const twice = read(once, 'day-1-a')

    expect(once[0].entitySlices).toEqual({ 'day-1': ['day-1-a'] })
    expect(once[0].readingSlices).toEqual({})
    expect(twice).toBe(once)
  })

  it('completes the day and marks the next one when the last element is read', () => {
    const result = read(read(read(started, 'day-1-a'), 'day-1:2'), 'day-1-c')

    expect(result[0].readingSlices).toEqual({ 'day-1': 'Completed', 'day-2': 'Next' })
    expect(result[0].entitySlices).toBeUndefined()
    expect(getReadEntitySliceKeys(day('day-1'), result[0])).toEqual([
      'day-1-a',
      'day-1:2',
      'day-1-c',
    ])
  })

  it('completes the plan when the last element of the last day is read', () => {
    const completedDays: OngoingPlan[] = [
      {
        id: 'plan-1',
        status: 'Progress',
        readingSlices: { 'day-1': 'Completed' },
        entitySlices: { 'day-2': ['day-2-a', 'day-2:2'] },
      },
    ]

    const result = read(completedDays, 'day-2-c', 'day-2')

    expect(result[0].status).toBe('Completed')
    expect(result[0].entitySlices).toBeUndefined()
  })

  it('reopens a day completed before element progress existed when an element is unread', () => {
    const legacy: OngoingPlan[] = [
      {
        id: 'plan-1',
        status: 'Progress',
        readingSlices: { 'day-1': 'Completed', 'day-2': 'Next' },
      },
    ]

    const result = unread(legacy, 'day-1:2')

    expect(result[0].readingSlices['day-1']).toBe('Next')
    expect(result[0].entitySlices).toEqual({ 'day-1': ['day-1-a', 'day-1-c'] })
  })

  it('unreads every element when the whole day is marked as unread', () => {
    const completed = read(read(read(started, 'day-1-a'), 'day-1:2'), 'day-1-c')
    const reopened = markReadingSliceAsRead({
      ongoingPlans: completed,
      plan,
      planId: 'plan-1',
      readingSliceId: 'day-1',
    })

    expect(getReadEntitySliceKeys(day('day-1'), reopened[0])).toEqual([])
  })

  it('forgets partial element progress when the whole day is marked as read', () => {
    const completed = markReadingSliceAsRead({
      ongoingPlans: read(started, 'day-1-a'),
      plan,
      planId: 'plan-1',
      readingSliceId: 'day-1',
    })

    expect(completed[0].readingSlices['day-1']).toBe('Completed')
    expect(completed[0].entitySlices).toBeUndefined()
  })

  it('ignores titles, unknown elements and plans that are not followed', () => {
    const preview: OngoingPlan[] = [{ id: 'plan-1', status: 'Idle', readingSlices: {} }]

    expect(read(started, 'day-1-title')).toBe(started)
    expect(read(started, 'missing')).toBe(started)
    expect(read(preview, 'day-1-a')).toBe(preview)
  })

  it('sees element progress when comparing ongoing plans', () => {
    expect(areOngoingPlansEqual(started, read(started, 'day-1-a'))).toBe(false)
    expect(areOngoingPlansEqual(read(started, 'day-1-a'), read(started, 'day-1-a'))).toBe(true)
  })
})

describe('getPlanDayStep', () => {
  const day: ReadingSlice = {
    id: 'day-2',
    slices: [
      { type: 'Video', id: 'video', title: 'BibleProject', url: 'https://example.com' },
      { type: 'Title', id: 'title', title: 'Lecture' },
      { type: 'Text', id: 'text', description: 'La méditation' },
      { type: 'Verse', verses: '23|49:13-16' },
    ],
  }

  it('leads to the next element to read, past the titles', () => {
    expect(getPlanDayStep(day, 'video')).toEqual({
      kind: 'next',
      slice: day.slices[2],
      index: 2,
      entitySliceId: 'text',
    })
  })

  it('identifies an element without an id by its place in the day', () => {
    expect(getPlanDayStep(day, 'text')).toMatchObject({ kind: 'next', entitySliceId: 'day-2:3' })
  })

  it('ends the day after its last element', () => {
    expect(getPlanDayStep(day, 'day-2:3')).toEqual({ kind: 'finish' })
  })

  it('knows nothing of an element outside the day', () => {
    expect(getPlanDayStep(day, 'title')).toBeUndefined()
    expect(getPlanDayStep(day, 'missing')).toBeUndefined()
  })
})
