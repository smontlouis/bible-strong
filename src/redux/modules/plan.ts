import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Plan, OngoingPlan, ReadingSlice } from '~common/types'
import { bibleProjectPlan } from '../../features/plans/bible-project-plan'
import { bibleProjectPlanMini } from '~features/plans/bible-project-plan-mini'

type ImageModel = { [key: string]: string }

interface PlanModel {
  myPlans: Plan[]
  onlinePlans: Plan[]
  ongoingPlans: OngoingPlan[]
  images: ImageModel
}

const initialState: PlanModel = {
  myPlans: [bibleProjectPlan, bibleProjectPlanMini],
  onlinePlans: [],
  ongoingPlans: [],
  images: {},
}

const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {
    cacheImage(state, action: PayloadAction<{ id: string; value: string }>) {
      state.images[action.payload.id] = action.payload.value
    },
    markAsRead(
      state,
      action: PayloadAction<{ readingSliceId: string; planId: string }>
    ) {
      const { readingSliceId, planId } = action.payload

      let ongoingPlan = state.ongoingPlans.find(oP => oP.id === planId)

      if (!ongoingPlan) {
        ongoingPlan = {
          id: planId,
          status: 'Progress',
          readingSlices: [],
        }
        state.ongoingPlans.push(ongoingPlan)
      }

      // Remove any plans in progress and put this one in Progress
      state.ongoingPlans.forEach(oP => {
        if (oP.status === 'Progress') {
          oP.status = 'Idle'
        }
      })
      ongoingPlan.status = 'Progress'

      const ongoingReadingSliceIndex = ongoingPlan.readingSlices.findIndex(
        rS => rS.id === readingSliceId
      )

      // Toggle
      if (ongoingReadingSliceIndex !== -1) {
        ongoingPlan.readingSlices.splice(ongoingReadingSliceIndex, 1)
      } else {
        ongoingPlan.readingSlices.push({
          id: readingSliceId,
          status: 'Completed',
        })
      }

      // Check if plan is complete
      const plan = state.myPlans.find(p => p.id === planId)
      const readingSlicesLength =
        plan?.sections.reduce(
          (acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices],
          []
        ).length || 0
      const ongoingReadingSlicesLength = ongoingPlan.readingSlices.length
      if (readingSlicesLength === ongoingReadingSlicesLength) {
        ongoingPlan.status = 'Completed'
      } else {
        ongoingPlan.status = 'Progress'
      }
    },
  },
})

export const { cacheImage, markAsRead } = planSlice.actions
export default planSlice.reducer
