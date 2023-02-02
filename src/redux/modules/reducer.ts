import { combineReducers } from 'redux'
import FilesystemStorage from 'redux-persist-filesystem-storage'

import { persistReducer } from 'redux-persist'

import user from './user'
import plan from './plan'

const planPersistConfig = {
  key: 'plan',
  keyPrefix: '',
  storage: FilesystemStorage,
  blacklist: ['onlinePlans', 'onlineStatus'],
  timeout: null,
}

const rootReducer = combineReducers({
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
