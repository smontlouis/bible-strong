import { combineReducers } from 'redux'

import bible from './bible'
import user from './user'
import plan from './plan'

const rootReducer = combineReducers({
  bible,
  user,
  plan,
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
