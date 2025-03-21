import { createStore, compose, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import {
  persistStore,
  persistReducer,
  createMigrate,
  getStoredState,
} from 'redux-persist'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'
import FilesystemStorage from 'redux-persist-filesystem-storage'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import migrations from './migrations'

import reducer from '~redux/modules/reducer'
import { mmkvStorage } from '~helpers/storage'
import { PersistConfig } from 'redux-persist/es/types'

function configureStore() {
  const persistConfig = {
    key: 'root',
    keyPrefix: '',
    storage: mmkvStorage,
    stateReconciler: autoMergeLevel2,
    version: 29,
    // debug: true,
    blacklist: ['plan'],
    migrate: createMigrate(migrations, { debug: true }),
    timeout: null,
  }

  // MMKV migration
  persistConfig.getStoredState = async (config) => {
    return getStoredState(config).catch((err) => {
      return getStoredState({ ...config, storage: FilesystemStorage })
    })
  }

  const middleware = [logger, crashReporter, firestoreMiddleware, thunk]

  const persistedReducer = persistReducer(persistConfig, reducer)
  const store = compose(applyMiddleware(...middleware))(createStore)(
    persistedReducer
  )
  const persistor = persistStore(store)
  // persistor.purge() // Purge async storage
  // storage.clearAll()

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
