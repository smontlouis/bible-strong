import { combineReducers } from 'redux'
import FSStorage from 'redux-persist-fs-storage'
import { persistReducer } from 'redux-persist'

import bible from './bible'
import user from './user'
import plan from './plan'

const planPersistConfig = {
  key: 'auth',
  storage: FSStorage(),
  blacklist: ['onlinePlans', 'onlineStatus'],
}

const rootReducer = combineReducers({
  bible,
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
