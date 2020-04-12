import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Plan, OngoingPlan, ReadingSlice } from '~common/types'
import { bibleProjectPlan } from '../../features/plans/bible-project-plan'
import { bibleProjectPlanMini } from '~features/plans/bible-project-plan-mini'
import { USER_LOGIN_SUCCESS, USER_LOGOUT } from './user'

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
    resetPlan(state, action: PayloadAction<string>) {
      const planToDeleteIndex = state.ongoingPlans.findIndex(
        plan => plan.id === action.payload
      )

      if (planToDeleteIndex !== -1) {
        state.ongoingPlans.splice(planToDeleteIndex, 1)
      }
    },
    markAsRead(
      state,
      action: PayloadAction<{ readingSliceId: string; planId: string }>
    ) {
      const { readingSliceId, planId } = action.payload

      let ongoingPlan = state.ongoingPlans.find(oP => oP.id === planId)
      const plan = state.myPlans.find(p => p.id === planId)
      const flattenedReadingSlices =
        plan?.sections.reduce(
          (acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices],
          []
        ) || []
      const readingSliceIndex = flattenedReadingSlices.findIndex(
        c => c.id === readingSliceId
      )

      // Create ongoingPlan if don't exists
      if (!ongoingPlan) {
        ongoingPlan = {
          id: planId,
          status: 'Progress',
          readingSlices: {},
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

      // Toggle reading slice by either removing it or complete it
      const ongoingReadingSlice = ongoingPlan.readingSlices[readingSliceId]

      if (ongoingReadingSlice && ongoingReadingSlice === 'Completed') {
        delete ongoingPlan.readingSlices[readingSliceId]

        // Put next on previous
        Object.keys(ongoingPlan.readingSlices).forEach(key => {
          if (ongoingPlan?.readingSlices[key] === 'Next')
            delete ongoingPlan?.readingSlices[key]
        })
        const prevReadingSliceId = flattenedReadingSlices[readingSliceIndex]?.id
        if (prevReadingSliceId) {
          ongoingPlan.readingSlices[prevReadingSliceId] = 'Next'
        }
      } else {
        ongoingPlan.readingSlices[readingSliceId] = 'Completed'

        //Put next on next
        Object.keys(ongoingPlan.readingSlices).forEach(key => {
          if (ongoingPlan?.readingSlices[key] === 'Next')
            delete ongoingPlan?.readingSlices[key]
        })
        const nextReadingSliceId =
          flattenedReadingSlices[readingSliceIndex + 1]?.id
        if (
          nextReadingSliceId &&
          ongoingPlan.readingSlices[nextReadingSliceId] !== 'Completed'
        ) {
          ongoingPlan.readingSlices[nextReadingSliceId] = 'Next'
        }
      }

      // Check if plan is complete
      const readingSlicesLength =
        plan?.sections.reduce(
          (acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices],
          []
        ).length || 0
      const ongoingReadingSlicesLength = Object.values(
        ongoingPlan.readingSlices
      ).filter(status => status === 'Completed').length

      if (readingSlicesLength === ongoingReadingSlicesLength) {
        ongoingPlan.status = 'Completed'
      } else {
        ongoingPlan.status = 'Progress'
      }
    },
  },
  extraReducers: {
    [USER_LOGIN_SUCCESS]: (state, action) => {
      const { plan } = action.profile
      const { localLastSeen, remoteLastSeen } = action

      if (plan) {
        if (remoteLastSeen > localLastSeen) {
          // Remote wins
          console.log('Plan - Remote wins')
          state.ongoingPlans = plan
        } else if (remoteLastSeen < localLastSeen) {
          console.log('Plan - Local wins')
          // Local wins - do nothing
        } else {
          console.log('Plan - Last seen equals remote last seen, do nothing')
        }
      }
    },
    [USER_LOGOUT]: state => {
      state.ongoingPlans = initialState.ongoingPlans
      state.myPlans = initialState.myPlans
      state.onlinePlans = initialState.onlinePlans
    },
  },
})

export const { cacheImage, resetPlan, markAsRead } = planSlice.actions
export default planSlice.reducer
