import { createStore, compose, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import reducer from '~redux/modules/reducer'

export default function configureStore () {
  const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

  const persistConfig = { key: 'root', storage }
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
