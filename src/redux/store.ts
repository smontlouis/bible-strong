import { configureStore as createRTKStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer, createMigrate, getStoredState } from 'redux-persist'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'
import FilesystemStorage from 'redux-persist-filesystem-storage'
import devToolsEnhancer from 'redux-devtools-expo-dev-plugin'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import migrations from './migrations'

import reducer from '~redux/modules/reducer'
import { mmkvStorage } from '~helpers/storage'

function configureStore() {
  const persistConfig: any = {
    key: 'root',
    keyPrefix: '',
    storage: mmkvStorage,
    stateReconciler: autoMergeLevel2,
    version: 30,
    // debug: true,
    blacklist: ['plan'],
    // @ts-ignore
    migrate: createMigrate(migrations, { debug: true }),
    timeout: null,
  }

  // MMKV migration
  // @ts-ignore
  persistConfig.getStoredState = async (config: any) => {
    return getStoredState(config).catch(err => {
      return getStoredState({ ...config, storage: FilesystemStorage })
    })
  }

  // @ts-ignore
  const persistedReducer = persistReducer(persistConfig, reducer)

  const store = createRTKStore({
    reducer: persistedReducer,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).concat(logger, crashReporter, firestoreMiddleware),
    devTools: false,
    enhancers: defaultEnhancers =>
      __DEV__ ? [...defaultEnhancers, devToolsEnhancer()] : defaultEnhancers,
  })

  const persistor = persistStore(store)
  // persistor.purge() // Purge async storage
  // storage.clearAll()

  if (__DEV__) {
    // @ts-ignore
    if (module.hot) {
      // @ts-ignore
      module.hot.accept(() => {
        const nextRootReducer = require('./modules/reducer').default
        store.replaceReducer(nextRootReducer)
      })
    }
  }

  return { store, persistor }
}

export const { store, persistor } = configureStore()
