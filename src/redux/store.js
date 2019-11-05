import { createStore, compose, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import { persistStore, persistReducer, createMigrate } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2'

import firestoreMiddleware from './firestoreMiddleware'
import { logger, crashReporter } from './logMiddleware'
import lastSeenMiddleware from './lastSeenMiddleware'
import migrations from './migrations'

import reducer from '~redux/modules/reducer'

export default function configureStore() {
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

  const persistConfig = {
    key: 'root',
    storage,
    stateReconciler: autoMergeLevel2,
    version: 9,
    // debug: true,
    migrate: createMigrate(migrations, { debug: true })
  }

  const middleware = [logger, lastSeenMiddleware, crashReporter, firestoreMiddleware, thunk]

  const persistedReducer = persistReducer(persistConfig, reducer)
  const store = composeEnhancers(applyMiddleware(...middleware))(createStore)(persistedReducer)
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
