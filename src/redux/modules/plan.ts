import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Plan } from '~common/types'
import { bibleProjectPlan } from '../../features/plans/bible-project-plan'

interface PlanModel {
  myPlans: Plan[]
  onlinePlans: Plan[]
}

const initialState: PlanModel = {
  myPlans: [bibleProjectPlan],
  onlinePlans: [],
}

const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {},
})

// export const { myAction } = planSlice.actions
export default planSlice.reducer
