import { createStore, compose, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import {
  persistStore,
  persistReducer,
  createMigrate,
  getStoredState,
} from 'redux-persist'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'
import AsyncStorage from '@react-native-async-storage/async-storage'
import FilesystemStorage from 'redux-persist-filesystem-storage'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import migrations from './migrations'

import reducer from '~redux/modules/reducer'

function configureStore() {
  const persistConfig = {
    key: 'root',
    keyPrefix: '',
    storage: FilesystemStorage,
    stateReconciler: autoMergeLevel2,
    version: 26,
    // debug: true,
    blacklist: ['plan'],
    migrate: createMigrate(migrations, { debug: true }),
  }

  // FileSystem migration
  persistConfig.getStoredState = async config => {
    return getStoredState(config).catch(err => {
      return getStoredState({ ...config, storage: AsyncStorage })
    })
  }

  const middleware = [logger, crashReporter, firestoreMiddleware, thunk]

  if (__DEV__) {
    const createDebugger = require('redux-flipper').default
    middleware.push(createDebugger())
  }

  const persistedReducer = persistReducer(persistConfig, reducer)
  const store = compose(applyMiddleware(...middleware))(createStore)(
    persistedReducer
  )
  const persistor = persistStore(store)
  // persistor.purge() // Purge async storage

  if (__DEV__) {
    if (module.hot) {
      module.hot.accept(() => {
        const nextRootReducer = require('./modules/reducer').default
        store.replaceReducer(nextRootReducer)
      })
    }
  }

  return { store, persistor }
}

export const { store, persistor } = configureStore()
