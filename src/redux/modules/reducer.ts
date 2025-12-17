import { combineReducers } from 'redux'

import { persistReducer } from 'redux-persist'

import { mmkvStorage } from '~helpers/storage'
import plan from './plan'
import user from './user'

const planPersistConfig: any = {
  key: 'plan',
  keyPrefix: '',
  storage: mmkvStorage,
  blacklist: ['onlinePlans', 'onlineStatus'],
  timeout: null,
}

const rootReducer = combineReducers({
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
