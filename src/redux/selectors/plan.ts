import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import { OngoingPlan, OnlinePlan, Plan } from '~common/types'

// Base selectors
const selectMyPlans = (state: RootState) => state.plan.myPlans
const selectOnlinePlans = (state: RootState) => state.plan.onlinePlans
const selectOngoingPlans = (state: RootState) => state.plan.ongoingPlans
const selectPlanState = (state: RootState) => state.plan

// Selector for sorted online plans (featured first)
export const selectSortedOnlinePlans = createSelector(
  [selectOnlinePlans],
  (onlinePlans): OnlinePlan[] => {
    return [...onlinePlans].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1))
  }
)

// Selector factory for finding a plan by id
export const makePlanByIdSelector = () =>
  createSelector(
    [selectMyPlans, (_: RootState, id: string) => id],
    (myPlans, id): Plan | undefined => {
      return myPlans.find(p => p.id === id)
    }
  )

// Selector factory for finding an ongoing plan by id
export const makeOngoingPlanByIdSelector = () =>
  createSelector(
    [selectOngoingPlans, (_: RootState, id: string) => id],
    (ongoingPlans, id): OngoingPlan | undefined => {
      return ongoingPlans.find(p => p.id === id)
    }
  )

// Cache for selector instances to avoid recreating them on every render
const selectorCache = {
  planById: new Map<string, ReturnType<typeof makePlanByIdSelector>>(),
  ongoingPlanById: new Map<string, ReturnType<typeof makeOngoingPlanByIdSelector>>(),
}

// Get or create a cached selector for plan by id
export const getPlanByIdSelector = (id: string) => {
  if (!selectorCache.planById.has(id)) {
    selectorCache.planById.set(id, makePlanByIdSelector())
  }
  return selectorCache.planById.get(id)!
}

// Get or create a cached selector for ongoing plan by id
export const getOngoingPlanByIdSelector = (id: string) => {
  if (!selectorCache.ongoingPlanById.has(id)) {
    selectorCache.ongoingPlanById.set(id, makeOngoingPlanByIdSelector())
  }
  return selectorCache.ongoingPlanById.get(id)!
}

// Selector factory for checking if a reading slice is completed
export const makeIsReadSelector = () =>
  createSelector(
    [
      selectOngoingPlans,
      (_: RootState, planId: string, readingSliceId: string) => ({ planId, readingSliceId }),
    ],
    (ongoingPlans, { planId, readingSliceId }): boolean => {
      const ongoingPlan = ongoingPlans.find(oP => oP.id === planId)
      return ongoingPlan?.readingSlices[readingSliceId] === 'Completed'
    }
  )

// Combined selector for plan and ongoing plan
export const makePlanWithOngoingSelector = () =>
  createSelector(
    [selectMyPlans, selectOngoingPlans, (_: RootState, id: string) => id],
    (myPlans, ongoingPlans, id) => ({
      plan: myPlans.find(p => p.id === id),
      ongoingPlan: ongoingPlans.find(p => p.id === id),
    })
  )

// Selector for user and plan state (used in ImportExportScreen and MoreScreen)
export const selectUserAndPlan = createSelector(
  [(state: RootState) => state.user, selectPlanState],
  (user, plan) => ({ user, plan })
)
