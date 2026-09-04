import { combineReducers } from 'redux'

import { persistReducer, type PersistConfig } from 'redux-persist'

import { mmkvStorage } from '~helpers/storage'
import plan from './plan'
import user from './user'

type PlanState = ReturnType<typeof plan>

const planPersistConfig: PersistConfig<PlanState> = {
  key: 'plan',
  keyPrefix: '',
  storage: mmkvStorage,
  blacklist: ['onlinePlans', 'onlineStatus'],
  timeout: null as unknown as number,
}

const rootReducer = combineReducers({
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
