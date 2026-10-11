import type { ComputedPlan, ComputedReadingSlice } from '~common/types'
import type { PlanTab } from '~state/tabs'
import {
  getLegacyPlanRouteId,
  getLegacyReadingRouteLocation,
  getRecoveredPlanTabTitle,
  leavePlanSliceInTab,
  openPlanSliceInTab,
} from '../planTabState'

const createReadingSlice = (id: string): ComputedReadingSlice => ({
  id,
  status: 'Idle',
  slices: [{ type: 'Verse', id: '1-1-1', verses: 'Gen 1:1' }],
})

const createComputedPlan = (): ComputedPlan => ({
  id: 'plan-1',
  title: 'Plan title',
  description: 'Plan description',
  author: { id: 'author-1', displayName: 'Author', photoUrl: '' },
  type: 'yearly',
  lang: 'fr',
  progress: 0,
  status: 'Progress',
  sections: [
    {
      id: 'section-1',
      title: 'Section 1',
      subTitle: 'Subtitle',
      progress: 0,
      data: [createReadingSlice('slice-1'), createReadingSlice('slice-2')],
    },
  ],
})

const createPlanTabData = (): PlanTab['data'] => ({
  planId: 'plan-1',
})

describe('planTabState', () => {
  it('recovers a stale Plan tab title from the Reading plan', () => {
    expect(getRecoveredPlanTabTitle('Old title', createComputedPlan())).toBe('Plan title')
    expect(getRecoveredPlanTabTitle('Plan title', createComputedPlan())).toBeUndefined()
  })

  it('opens and leaves Plan slice state without changing the Reading plan anchor', () => {
    const data = createPlanTabData()
    const opened = openPlanSliceInTab(data, 'slice-1')
    const closed = leavePlanSliceInTab(opened)

    expect(opened).toEqual({ planId: 'plan-1', readingSliceId: 'slice-1' })
    expect(closed).toEqual({ planId: 'plan-1', readingSliceId: undefined })
  })
})

describe('legacy route recovery', () => {
  it('recovers only identity from old content snapshots', () => {
    expect(
      getLegacyPlanRouteId(JSON.stringify({ id: 'plan-a', title: 'Old title', sections: [] }))
    ).toBe('plan-a')
    expect(
      getLegacyReadingRouteLocation(
        JSON.stringify({
          id: 'day-a',
          planId: 'plan-a',
          slices: [{ type: 'Text', description: 'Old text' }],
        })
      )
    ).toEqual({ planId: 'plan-a', readingSliceId: 'day-a' })
  })

  it.each([undefined, null, 'not-json', 'null', '[]', '{}', '{"id":12}', '{"id":""}'])(
    'does not throw on a malformed plan link: %s',
    value => {
      expect(getLegacyPlanRouteId(value)).toBeUndefined()
    }
  )

  it.each([
    '{}',
    '{"id":"a"}',
    '{"planId":"p"}',
    '{"id":3,"planId":"p"}',
    '{"id":"a","planId":""}',
    'broken',
  ])('does not recover an invalid reading location: %s', value => {
    expect(getLegacyReadingRouteLocation(value)).toBeUndefined()
  })
})
