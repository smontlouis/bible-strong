import { combineReducers } from 'redux'
import FilesystemStorage from 'redux-persist-filesystem-storage'
import AsyncStorage from '@react-native-community/async-storage'

import { persistReducer } from 'redux-persist'

import bible from './bible'
import user from './user'
import plan from './plan'

const planPersistConfig = {
  key: 'plan',
  keyPrefix: '',
  storage: FilesystemStorage,
  blacklist: ['onlinePlans', 'onlineStatus'],
}

const rootReducer = combineReducers({
  bible,
  user,
  plan: persistReducer(planPersistConfig, plan),
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
