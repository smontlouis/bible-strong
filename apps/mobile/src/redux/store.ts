import { configureStore as createRTKStore } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
  createMigrate,
  getStoredState,
  type PersistConfig,
} from 'redux-persist'
import type { PersistedState } from 'redux-persist/es/types'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'
import FilesystemStorage from 'redux-persist-filesystem-storage'
import devToolsEnhancer from 'redux-devtools-expo-dev-plugin'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import migrations from './migrations'
import { applyPreferredColorScheme, themeAppearanceMiddleware } from './themeAppearanceMiddleware'

import reducer from '~redux/modules/reducer'
import { mmkvStorage, storage } from '~helpers/storage'
import { tryCaptureLegacyReferenceEvidenceFromReduxState } from '../migrations/legacyResourceEvidence'
import {
  LEGACY_COMMENTARY_SELECTION_STORAGE_KEY,
  migrateCommentarySelectionState,
} from '~features/commentaries/commentarySelection'

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
    version: 38,
    // debug: true,
    blacklist: ['plan'],
    migrate: createMigrate(migrations as unknown as Parameters<typeof createMigrate>[0], {
      debug: true,
    }),
    timeout: null as unknown as number,
  }

  // MMKV migration
  persistConfig.getStoredState = async config => {
    const storedState = (await getStoredState(config).catch(() =>
      getStoredState({ ...config, storage: FilesystemStorage })
    )) as PersistedState
    tryCaptureLegacyReferenceEvidenceFromReduxState(storedState, storage)
    const legacyCommentarySelection = storage.getString(LEGACY_COMMENTARY_SELECTION_STORAGE_KEY)
    if (legacyCommentarySelection && storedState && typeof storedState === 'object') {
      try {
        const persistedUser = (
          storedState as PersistedState & {
            user?: { bible?: { settings?: { commentarySelection?: unknown } } }
          }
        ).user
        const persistedSettings = persistedUser?.bible?.settings
        if (persistedSettings && persistedSettings.commentarySelection === undefined) {
          persistedSettings.commentarySelection = migrateCommentarySelectionState(
            JSON.parse(legacyCommentarySelection)
          )
        }
      } catch {
        // Ignore a malformed legacy preference; migration 38 will use language defaults.
      }
    }
    return storedState
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

  const manualPersistOptions = { manualPersist: true } as Parameters<typeof persistStore>[1] & {
    manualPersist: boolean
  }
  const persistor = persistStore(store, manualPersistOptions, () => {
    const preferredColorScheme = store.getState().user.bible.settings.preferredColorScheme
    if (preferredColorScheme !== 'auto') {
      applyPreferredColorScheme(preferredColorScheme)
    }
  })
  let persistenceStarted = false
  const startPersistence = () => {
    if (persistenceStarted) return
    persistenceStarted = true
    persistor.persist()
  }
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

  return { store, persistor, startPersistence }
}

export const { store, persistor, startPersistence } = configureStore()

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
