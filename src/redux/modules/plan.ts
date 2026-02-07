import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { OngoingPlan, OnlinePlan, Plan, ReadingSlice, Section, Status } from '~common/types'
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
// import { getLangIsFr } from '~i18n'
import { RootState } from './reducer'
import { FireStoreUserData, IMPORT_DATA, RECEIVE_LIVE_UPDATES, USER_LOGOUT } from './user'

// const bibleProjectPlan: Plan = require('~assets/plans/bible-project-plan')
// const bibleProjectPlanEn: Plan = require('~assets/plans/bible-project-plan-en')

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
  async ({ id, update = false }: { id: string; update?: boolean }) => {
    const planRef = doc(firebaseDb, 'plans', id)

    const planSnapshot = await getDoc(planRef)
    const plan = planSnapshot.data() as OnlinePlan

    if (update) {
      updateDoc(planRef, { downloads: increment })
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
        return (await dispatch(fetchPlan({ id: planIdNeedsUpdate }))) as any
      })
    )
  }
)

const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {
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
      state.myPlans.push(action.payload)
    },
    markAsRead(state, action: PayloadAction<{ readingSliceId: string; planId: string }>) {
      const { readingSliceId, planId } = action.payload

      let ongoingPlan = state.ongoingPlans.find(oP => oP.id === planId)
      const plan = state.myPlans.find(p => p.id === planId)
      const flattenedReadingSlices =
        plan?.sections.reduce((acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices], []) ||
        []
      const readingSliceIndex = flattenedReadingSlices.findIndex(c => c.id === readingSliceId)

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
          if (ongoingPlan?.readingSlices[key] === 'Next') delete ongoingPlan?.readingSlices[key]
        })
        const prevReadingSliceId = flattenedReadingSlices[readingSliceIndex]?.id
        if (prevReadingSliceId) {
          ongoingPlan.readingSlices[prevReadingSliceId] = 'Next'
        }
      } else {
        ongoingPlan.readingSlices[readingSliceId] = 'Completed'

        //Put next on next
        Object.keys(ongoingPlan.readingSlices).forEach(key => {
          if (ongoingPlan?.readingSlices[key] === 'Next') delete ongoingPlan?.readingSlices[key]
        })
        const nextReadingSliceId = flattenedReadingSlices[readingSliceIndex + 1]?.id
        if (nextReadingSliceId && ongoingPlan.readingSlices[nextReadingSliceId] !== 'Completed') {
          ongoingPlan.readingSlices[nextReadingSliceId] = 'Next'
        }
      }

      // Check if plan is complete
      const readingSlicesLength =
        plan?.sections.reduce((acc: ReadingSlice[], curr) => [...acc, ...curr.readingSlices], [])
          .length || 0
      const ongoingReadingSlicesLength = Object.values(ongoingPlan.readingSlices).filter(
        status => status === 'Completed'
      ).length

      if (readingSlicesLength === ongoingReadingSlicesLength) {
        ongoingPlan.status = 'Completed'
      } else {
        ongoingPlan.status = 'Progress'
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchPlan.fulfilled, (state, action: PayloadAction<Plan>) => {
      let planAlreadyExistsIndex = state.myPlans.findIndex(
        myPlan => action.payload.id === myPlan.id
      )
      if (planAlreadyExistsIndex !== -1) {
        state.myPlans[planAlreadyExistsIndex] = action.payload
      } else {
        state.myPlans.push(action.payload)
      }

      const ongoingPlan = state.ongoingPlans.find(oP => oP.id === action.payload.id)

      if (!ongoingPlan) {
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
    builder.addCase(RECEIVE_LIVE_UPDATES, (state, action: any) => {
      const { plan } = action.payload.remoteUserData as FireStoreUserData

      if (plan) {
        state.ongoingPlans = plan
      }
    })
    builder.addCase(IMPORT_DATA, (state, action: any) => {
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

export const { cacheImage, resetPlan, markAsRead, removePlan, addPlan } = planSlice.actions
export default planSlice.reducer
