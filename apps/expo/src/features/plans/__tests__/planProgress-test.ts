import type { OngoingPlan, Plan, ReadingSlice, Section } from '~common/types'
import {
  areOngoingPlansEqual,
  buildComputedPlan,
  buildComputedPlanItem,
  calculateReadingProgress,
  markReadingSliceAsRead,
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
        ongoingPlans: [],
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
        ongoingPlans: [],
        plan,
        planId: 'plan-1',
        readingSliceId: 'slice-1',
      })

      expect(ongoingPlans[0].status).toBe('Completed')
    })

    it('moves other in-progress Reading plans to Idle', () => {
      const plan = createPlan('plan-2', [
        createSection('section-1', [createReadingSlice('slice-2')]),
      ])

      const ongoingPlans = markReadingSliceAsRead({
        ongoingPlans: [
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

      expect(ongoingPlans.find(ongoingPlan => ongoingPlan.id === 'plan-1')?.status).toBe('Idle')
      expect(ongoingPlans.find(ongoingPlan => ongoingPlan.id === 'plan-2')?.status).toBe(
        'Completed'
      )
    })
  })
})
