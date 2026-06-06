import { configureStore as createRTKStore } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
  createMigrate,
  getStoredState,
  type PersistConfig,
} from 'redux-persist'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'
import FilesystemStorage from 'redux-persist-filesystem-storage'
import devToolsEnhancer from 'redux-devtools-expo-dev-plugin'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import migrations from './migrations'
import { applyPreferredColorScheme, themeAppearanceMiddleware } from './themeAppearanceMiddleware'

import reducer from '~redux/modules/reducer'
import { mmkvStorage } from '~helpers/storage'

type RootReducerState = ReturnType<typeof reducer>
type HotModule = NodeJS.Module & {
  hot?: {
    accept: (callback: () => void) => void
  }
}

function configureStore() {
  const persistConfig: PersistConfig<RootReducerState> = {
    key: 'root',
    keyPrefix: '',
    storage: mmkvStorage,
    stateReconciler: autoMergeLevel2,
    version: 35,
    // debug: true,
    blacklist: ['plan'],
    migrate: createMigrate(migrations as unknown as Parameters<typeof createMigrate>[0], {
      debug: true,
    }),
    timeout: null as unknown as number,
  }

  // MMKV migration
  persistConfig.getStoredState = async config => {
    const storedState = getStoredState(config).catch(err => {
      return getStoredState({ ...config, storage: FilesystemStorage })
    })
    return storedState as ReturnType<NonNullable<typeof persistConfig.getStoredState>>
  }

  const persistedReducer = persistReducer(persistConfig, reducer)

  const store = createRTKStore({
    reducer: persistedReducer,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).concat(logger, crashReporter, themeAppearanceMiddleware, firestoreMiddleware),
    devTools: false,
    enhancers: defaultEnhancers =>
      __DEV__ ? [...defaultEnhancers, devToolsEnhancer()] : defaultEnhancers,
  })

  const persistor = persistStore(store, undefined, () => {
    const preferredColorScheme = store.getState().user.bible.settings.preferredColorScheme
    if (preferredColorScheme !== 'auto') {
      applyPreferredColorScheme(preferredColorScheme)
    }
  })
  // persistor.purge() // Purge async storage
  // storage.clearAll()

  if (__DEV__) {
    const hotModule = module as HotModule
    if (hotModule.hot) {
      hotModule.hot.accept(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nextRootReducer = require('./modules/reducer').default
        store.replaceReducer(nextRootReducer)
      })
    }
  }

  return { store, persistor }
}

export const { store, persistor } = configureStore()

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
