import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { OngoingPlan, OnlinePlan, Plan, Section, Status } from '~common/types'
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import {
  firebaseDb,
  increment,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from '~helpers/firebase'
import { RootState } from './reducer'
import { importData, receiveLiveUpdates, USER_LOGOUT } from './user'
import { markReadingSliceAsRead } from '~features/plans/planProgress'
import { getEditorialKind, isCivilDate } from '~features/plans/readingCalendar'

type ImageModel = { [key: string]: string }

interface PlanModel {
  onlineStatus: Status
  myPlans: Plan[]
  onlinePlans: OnlinePlan[]
  ongoingPlans: OngoingPlan[]
  images: ImageModel
}

const initialState: PlanModel = {
  onlineStatus: 'Idle',
  myPlans: [],
  onlinePlans: [],
  ongoingPlans: [],
  images: {},
}

const docsArr = async (collectionName: string) => {
  const snapshot = await getDocs(collection(firebaseDb, collectionName))

  return snapshot.docs.map((x: FirebaseFirestoreTypes.QueryDocumentSnapshot) => x.data())
}

export const fetchPlans = createAsyncThunk('plan/fetchPlans', async () => {
  const results = (await docsArr('plans')) as OnlinePlan[]
  return results
})

export const fetchPlan = createAsyncThunk(
  'plan/fetchPlan',
  async ({ id, update = false }: { id: string; update?: boolean; enroll?: boolean }) => {
    const planRef = doc(firebaseDb, 'plans', id)

    const planSnapshot = await getDoc(planRef)
    const plan = planSnapshot.data() as OnlinePlan
    if (!plan) throw new Error('Reading content is unavailable')

    if (update) {
      await updateDoc(planRef, { downloads: increment })
    }

    const snapshot = await getDocs(collection(firebaseDb, 'plans', id, 'plan-sections'))
    const sections = snapshot.docs.map((x: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      x.data()
    ) as Section[]

    return { ...plan, sections }
  }
)

export const updatePlans = createAsyncThunk(
  'plan/updatesPlans',
  async (arg, { dispatch, getState }) => {
    const myPlans: Plan[] = (getState() as RootState).plan.myPlans

    if (!myPlans.length) {
      return
    }

    await dispatch(fetchPlans())
    const onlinePlans = (getState() as RootState).plan.onlinePlans

    const planIdsNeedsUpdate = myPlans
      .filter(myPlan => {
        const myPlanLastUpdate = myPlan.lastUpdate
        const onlinePlanLastUpdate = onlinePlans.find(
          onlinePlan => onlinePlan.id === myPlan.id
        )?.lastUpdate

        if (myPlanLastUpdate && onlinePlanLastUpdate) {
          if (myPlanLastUpdate < onlinePlanLastUpdate) {
            return true
          }
          return false
        }

        return true
      })
      .map(f => f.id)

    await Promise.all(
      planIdsNeedsUpdate.map(async planIdNeedsUpdate => {
        return dispatch(fetchPlan({ id: planIdNeedsUpdate }))
      })
    )
  }
)

const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {
    startPlan(state, action: PayloadAction<{ planId: string; startDate: string }>) {
      const { planId, startDate } = action.payload
      const plan = state.myPlans.find(item => item.id === planId)
      if (!plan || getEditorialKind(plan) !== 'reading-plan' || !isCivilDate(startDate)) return
      const existing = state.ongoingPlans.find(item => item.id === planId)
      if (existing) {
        existing.startDate = startDate
        if (existing.status !== 'Completed') existing.status = 'Progress'
      } else {
        state.ongoingPlans.push({ id: planId, status: 'Progress', readingSlices: {}, startDate })
      }
    },
    setPlanReminder(state, action: PayloadAction<{ planId: string; time: string | null }>) {
      const plan = state.ongoingPlans.find(item => item.id === action.payload.planId)
      const { time } = action.payload
      if (!plan || (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return
      if (time === null) delete plan.reminderTime
      else plan.reminderTime = time
    },
    cacheImage(state, action: PayloadAction<{ id: string; value: string }>) {
      state.images[action.payload.id] = action.payload.value
    },
    removePlan(state, action: PayloadAction<string>) {
      const planToResetIndex = state.ongoingPlans.findIndex(plan => plan.id === action.payload)

      if (planToResetIndex !== -1) {
        state.ongoingPlans.splice(planToResetIndex, 1)
      }

      const planToDeleteIndex = state.myPlans.findIndex(plan => plan.id === action.payload)

      if (planToDeleteIndex !== -1) {
        state.myPlans.splice(planToDeleteIndex, 1)
      }
    },
    resetPlan(state, action: PayloadAction<string>) {
      const planToDeleteIndex = state.ongoingPlans.findIndex(plan => plan.id === action.payload)

      if (planToDeleteIndex !== -1) {
        state.ongoingPlans.splice(planToDeleteIndex, 1)
      }
    },
    addPlan(state, action: PayloadAction<Plan>) {
      if (!state.myPlans.some(plan => plan.id === action.payload.id))
        state.myPlans.push(action.payload)
    },
    markAsRead(state, action: PayloadAction<{ readingSliceId: string; planId: string }>) {
      const { readingSliceId, planId } = action.payload
      const plan = state.myPlans.find(p => p.id === planId)
      state.ongoingPlans = markReadingSliceAsRead({
        ongoingPlans: state.ongoingPlans,
        plan,
        planId,
        readingSliceId,
      })
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchPlan.fulfilled, (state, action) => {
      let planAlreadyExistsIndex = state.myPlans.findIndex(
        myPlan => action.payload.id === myPlan.id
      )
      if (planAlreadyExistsIndex !== -1) {
        state.myPlans[planAlreadyExistsIndex] = action.payload
      } else {
        state.myPlans.push(action.payload)
      }

      const ongoingPlan = state.ongoingPlans.find(oP => oP.id === action.payload.id)

      if (!ongoingPlan && action.meta?.arg?.enroll === true) {
        state.ongoingPlans.push({
          id: action.payload.id,
          status: 'Idle',
          readingSlices: {},
        })
      }
    })
    builder.addCase(fetchPlans.pending, state => {
      state.onlineStatus = 'Pending'
    })
    builder.addCase(fetchPlans.rejected, state => {
      state.onlineStatus = 'Rejected'
    })
    builder.addCase(fetchPlans.fulfilled, (state, action: PayloadAction<OnlinePlan[]>) => {
      state.onlineStatus = 'Resolved'
      state.onlinePlans = action.payload
    })
    builder.addCase(receiveLiveUpdates, (state, action) => {
      const { plan } = action.payload.remoteUserData

      if (plan) {
        state.ongoingPlans = plan
      }
    })
    builder.addCase(importData, (state, action) => {
      const { plan } = action.payload

      if (plan) {
        state.ongoingPlans = plan
      }
    })
    builder.addCase(USER_LOGOUT, state => {
      state.ongoingPlans = initialState.ongoingPlans
      state.myPlans = initialState.myPlans
      state.onlinePlans = initialState.onlinePlans
    })
  },
})

export const {
  cacheImage,
  resetPlan,
  markAsRead,
  removePlan,
  addPlan,
  startPlan,
  setPlanReminder,
} = planSlice.actions
export default planSlice.reducer
