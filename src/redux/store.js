import { createStore, compose, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import { persistStore, persistReducer, createMigrate } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'

import reducer from '~redux/modules/reducer'

export default function configureStore () {
  const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

  const migrations = {
    // Added 'press' in 'settings'
    0: (state) => {
      return {
        ...state,
        user: {
          ...state.user,
          bible: {
            ...state.user.bible,
            settings: {
              ...state.user.bible.settings,
              press: 'shortPress'
            }
          }
        }
      }
    },
    1: (state) => {
      return {
        ...state,
        user: {
          ...state.user,
          bible: {
            ...state.user.bible,
            changelog: {}
          }
        }
      }
    },
    2: (state) => {
      return {
        ...state,
        user: {
          ...state.user,
          bible: {
            ...state.user.bible,
            settings: {
              ...state.user.bible.settings,
              notesDisplay: 'inline'
            }
          }
        }
      }
    }
  }

  const persistConfig = {
    key: 'root',
    storage,
    stateReconciler: autoMergeLevel2,
    version: 2,
    debug: true,
    migrate: createMigrate(migrations, { debug: true })
  }

  const persistedReducer = persistReducer(persistConfig, reducer)
  const store = composeEnhancers(applyMiddleware(thunk))(createStore)(persistedReducer)
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
