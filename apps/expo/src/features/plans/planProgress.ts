import type {
  ComputedPlan,
  ComputedPlanItem,
  ComputedSection,
  OngoingPlan,
  OngoingReadingSlice,
  Plan,
  ReadingSlice,
  Section,
} from '~common/types'
import { getEditorialKind } from './readingCalendar'

/** An old download alone is not participation. Legacy reading history remains resumable. */
export const hasPlanParticipation = (participation?: OngoingPlan): boolean =>
  Boolean(
    participation &&
    (participation.startDate ||
      participation.status === 'Progress' ||
      participation.status === 'Completed' ||
      Object.values(participation.readingSlices).some(status => status === 'Completed'))
  )

export const canUpdatePlanProgress = (plan?: Plan, participation?: OngoingPlan): boolean =>
  Boolean(plan && getEditorialKind(plan) === 'reading-plan' && hasPlanParticipation(participation))

export const getPlanReadingSlices = (plan?: Pick<Plan, 'sections'>): ReadingSlice[] =>
  plan?.sections.flatMap(section => section.readingSlices) ?? []

export const getOngoingReadingSlices = (
  ongoingPlan?: Pick<OngoingPlan, 'readingSlices'>
): OngoingReadingSlice[] =>
  Object.entries(ongoingPlan?.readingSlices ?? {}).map(([id, status]) => ({ id, status }))

export const calculateReadingProgress = (
  readingSlices: ReadingSlice[],
  ongoingReadingSlices: OngoingReadingSlice[] = []
): number => {
  if (!readingSlices.length || !ongoingReadingSlices.length) return 0

  const completedIds = new Set(
    ongoingReadingSlices.filter(slice => slice.status === 'Completed').map(slice => slice.id)
  )
  const completedCount = readingSlices.filter(slice => completedIds.has(slice.id)).length

  return completedCount / readingSlices.length
}

export const buildComputedSections = (
  sections: Section[],
  ongoingReadingSlices: OngoingReadingSlice[] = []
): ComputedSection[] => {
  const statusByReadingSliceId = new Map(
    ongoingReadingSlices.map(slice => [slice.id, slice.status])
  )

  return sections.map(section => ({
    ...section,
    progress: calculateReadingProgress(section.readingSlices, ongoingReadingSlices),
    readingSlices: undefined,
    data: section.readingSlices.map(readingSlice => ({
      ...readingSlice,
      status: statusByReadingSliceId.get(readingSlice.id) ?? 'Idle',
    })),
  }))
}

export const buildComputedPlan = (plan: Plan, ongoingPlan?: OngoingPlan): ComputedPlan => {
  const ongoingReadingSlices = getOngoingReadingSlices(ongoingPlan)
  const readingSlices = getPlanReadingSlices(plan)

  return {
    ...plan,
    status: ongoingPlan?.status ?? 'Idle',
    progress: calculateReadingProgress(readingSlices, ongoingReadingSlices),
    sections: buildComputedSections(plan.sections, ongoingReadingSlices),
  }
}

export const buildComputedPlanItem = (plan: Plan, ongoingPlan?: OngoingPlan): ComputedPlanItem => {
  const { sections, ...planItem } = plan
  const ongoingReadingSlices = getOngoingReadingSlices(ongoingPlan)

  return {
    ...planItem,
    status: ongoingPlan?.status ?? 'Idle',
    progress: calculateReadingProgress(getPlanReadingSlices(plan), ongoingReadingSlices),
  }
}

export const areOngoingPlansEqual = (prev: OngoingPlan[], next: OngoingPlan[]): boolean => {
  if (prev.length !== next.length) return false

  for (let index = 0; index < prev.length; index += 1) {
    const prevPlan = prev[index]
    const nextPlan = next[index]
    if (!prevPlan || !nextPlan) return false
    if (prevPlan.id !== nextPlan.id || prevPlan.status !== nextPlan.status) return false
    if (
      prevPlan.startDate !== nextPlan.startDate ||
      prevPlan.reminderTime !== nextPlan.reminderTime
    )
      return false

    const prevEntries = Object.entries(prevPlan.readingSlices ?? {})
    const nextEntries = Object.entries(nextPlan.readingSlices ?? {})
    if (prevEntries.length !== nextEntries.length) return false

    for (const [readingSliceId, status] of prevEntries) {
      if (nextPlan.readingSlices?.[readingSliceId] !== status) return false
    }
  }

  return true
}

export const markReadingSliceAsRead = ({
  ongoingPlans,
  plan,
  planId,
  readingSliceId,
}: {
  ongoingPlans: OngoingPlan[]
  plan?: Plan
  planId: string
  readingSliceId: string
}): OngoingPlan[] => {
  const readingSlices = getPlanReadingSlices(plan)
  const readingSliceIndex = readingSlices.findIndex(slice => slice.id === readingSliceId)
  const existingOngoingPlan = ongoingPlans.find(ongoingPlan => ongoingPlan.id === planId)
  if (readingSliceIndex < 0 || !canUpdatePlanProgress(plan, existingOngoingPlan))
    return ongoingPlans
  const nextOngoingPlans: OngoingPlan[] = ongoingPlans.map(ongoingPlan => ({
    ...ongoingPlan,
    readingSlices: { ...ongoingPlan.readingSlices },
  }))

  const targetOngoingPlanIndex = nextOngoingPlans.findIndex(
    ongoingPlan => ongoingPlan.id === planId
  )

  const targetOngoingPlan = nextOngoingPlans[targetOngoingPlanIndex]
  const currentStatus = existingOngoingPlan?.readingSlices[readingSliceId]

  if (currentStatus === 'Completed') {
    delete targetOngoingPlan.readingSlices[readingSliceId]

    Object.keys(targetOngoingPlan.readingSlices).forEach(key => {
      if (targetOngoingPlan?.readingSlices[key] === 'Next') {
        delete targetOngoingPlan.readingSlices[key]
      }
    })

    const currentReadingSliceId = readingSlices[readingSliceIndex]?.id
    if (currentReadingSliceId) {
      targetOngoingPlan.readingSlices[currentReadingSliceId] = 'Next'
    }
  } else {
    targetOngoingPlan.readingSlices[readingSliceId] = 'Completed'

    Object.keys(targetOngoingPlan.readingSlices).forEach(key => {
      if (targetOngoingPlan?.readingSlices[key] === 'Next') {
        delete targetOngoingPlan.readingSlices[key]
      }
    })

    const nextReadingSliceId = readingSlices[readingSliceIndex + 1]?.id
    if (nextReadingSliceId && targetOngoingPlan.readingSlices[nextReadingSliceId] !== 'Completed') {
      targetOngoingPlan.readingSlices[nextReadingSliceId] = 'Next'
    }
  }

  const completedCount = readingSlices.filter(
    reading => targetOngoingPlan.readingSlices[reading.id] === 'Completed'
  ).length

  targetOngoingPlan.status = readingSlices.length === completedCount ? 'Completed' : 'Progress'

  return nextOngoingPlans
}
