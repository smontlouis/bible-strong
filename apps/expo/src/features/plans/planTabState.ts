import type { ComputedPlan } from '~common/types'
import type { PlanTab } from '~state/tabs'

const readLegacyRouteObject = (serialized: unknown): Record<string, unknown> | undefined => {
  if (typeof serialized !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(serialized)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** Old links carry full snapshots. Recover only identity and load the current content. */
export const getLegacyPlanRouteId = (serialized: unknown): string | undefined => {
  const id = readLegacyRouteObject(serialized)?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

export const getLegacyReadingRouteLocation = (serialized: unknown) => {
  const value = readLegacyRouteObject(serialized)
  return value &&
    typeof value.planId === 'string' &&
    value.planId &&
    typeof value.id === 'string' &&
    value.id
    ? { planId: value.planId, readingSliceId: value.id }
    : undefined
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
  meditationDate: undefined,
})

export const leavePlanSliceInTab = (data: PlanTab['data']): PlanTab['data'] => ({
  ...data,
  readingSliceId: undefined,
  meditationDate: undefined,
})
