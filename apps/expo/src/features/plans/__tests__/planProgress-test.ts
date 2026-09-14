import type { OngoingPlan, Plan, ReadingSlice, Section } from '~common/types'
import {
  areOngoingPlansEqual,
  buildComputedPlan,
  buildComputedPlanItem,
  calculateReadingProgress,
  markReadingSliceAsRead,
  hasPlanParticipation,
  canUpdatePlanProgress,
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
