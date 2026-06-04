import type { ComputedPlan, ComputedReadingSlice, Plan } from '~common/types'
import type { PlanTab } from '~state/tabs'

export type PlanTabReadingSlice = ComputedReadingSlice & {
  planId: string
  planTitle: string
  planLanguage?: Plan['lang']
}

export type PlanTabContent =
  | { type: 'missing-plan' }
  | { type: 'plan' }
  | { type: 'reading-slice'; readingSlice: PlanTabReadingSlice }

export const findPlanTabReadingSlice = (
  plan: ComputedPlan | undefined,
  readingSliceId: string | undefined
): ComputedReadingSlice | undefined => {
  if (!plan || !readingSliceId) return undefined

  for (const section of plan.sections) {
    const readingSlice = section.data.find(slice => slice.id === readingSliceId)
    if (readingSlice) return readingSlice
  }

  return undefined
}

export const buildPlanTabReadingSlice = (
  plan: ComputedPlan,
  readingSlice: ComputedReadingSlice
): PlanTabReadingSlice => ({
  ...readingSlice,
  planId: plan.id,
  planTitle: plan.title,
  planLanguage: plan.lang,
})

export const resolvePlanTabContent = (
  plan: ComputedPlan | undefined,
  readingSliceId: string | undefined
): PlanTabContent => {
  if (!plan) return { type: 'missing-plan' }

  const readingSlice = findPlanTabReadingSlice(plan, readingSliceId)
  if (readingSlice) {
    return {
      type: 'reading-slice',
      readingSlice: buildPlanTabReadingSlice(plan, readingSlice),
    }
  }

  return { type: 'plan' }
}

export const getRecoveredPlanTabTitle = (
  currentTitle: string,
  plan: ComputedPlan | undefined
): string | undefined => {
  if (!plan?.title || plan.title === currentTitle) return undefined
  return plan.title
}

export const openPlanSliceInTab = (
  data: PlanTab['data'],
  readingSliceId: string
): PlanTab['data'] => ({
  ...data,
  readingSliceId,
})

export const leavePlanSliceInTab = (data: PlanTab['data']): PlanTab['data'] => ({
  ...data,
  readingSliceId: undefined,
})
