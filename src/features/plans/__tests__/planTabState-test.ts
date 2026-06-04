import type { ComputedPlan, ComputedReadingSlice } from '~common/types'
import type { PlanTab } from '~state/tabs'
import {
  findPlanTabReadingSlice,
  getRecoveredPlanTabTitle,
  leavePlanSliceInTab,
  openPlanSliceInTab,
  resolvePlanTabContent,
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
  it('finds an active Plan slice by identifier', () => {
    const plan = createComputedPlan()

    expect(findPlanTabReadingSlice(plan, 'slice-2')?.id).toBe('slice-2')
  })

  it('resolves missing Reading plans', () => {
    expect(resolvePlanTabContent(undefined, 'slice-1')).toEqual({ type: 'missing-plan' })
  })

  it('resolves active Plan slice content with tab metadata', () => {
    const plan = createComputedPlan()

    const content = resolvePlanTabContent(plan, 'slice-1')

    expect(content).toEqual({
      type: 'reading-slice',
      readingSlice: {
        ...plan.sections[0].data[0],
        planId: 'plan-1',
        planTitle: 'Plan title',
        planLanguage: 'fr',
      },
    })
  })

  it('falls back to Reading plan content when the stored Plan slice is missing', () => {
    expect(resolvePlanTabContent(createComputedPlan(), 'missing-slice')).toEqual({ type: 'plan' })
  })

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
