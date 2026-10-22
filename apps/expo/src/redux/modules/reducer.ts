import { combineReducers } from 'redux'

import { persistReducer, type PersistConfig } from 'redux-persist'

import { storage } from '~helpers/storage'
import { createKeyedPersistStorage } from '~redux/keyedPersistStorage'
import plan from './plan'
import user from './user'

type PlanState = ReturnType<typeof plan>

// The followed plans weigh several MB and the progress a few KB: each key of the slice is stored
// on its own, so ticking a reading writes the progress alone (see `keyedPersistStorage`).
const planPersistConfig: PersistConfig<PlanState> & { deserialize: false } = {
  key: 'plan',
  keyPrefix: '',
  storage: createKeyedPersistStorage(storage),
  serialize: false,
  // Read by redux-persist 6's getStoredState, missing from its types.
  deserialize: false,
  blacklist: ['onlinePlans', 'onlineStatus'],
  timeout: null as unknown as number,
}

const rootReducer = combineReducers({
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
