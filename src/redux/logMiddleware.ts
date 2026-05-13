import * as Sentry from '@sentry/react-native'
import type { Middleware } from '@reduxjs/toolkit'

const isReduxAction = (action: unknown): action is { type: string } =>
  !!action && typeof action === 'object' && 'type' in action

export const logger: Middleware = _store => next => action => {
  Sentry.addBreadcrumb({
    category: 'Dispatch',
    message: isReduxAction(action) ? action.type : 'unknown',
    data: action,
  })
  if (__DEV__ && isReduxAction(action)) {
    console.log('[Redux]', action.type)
  }

  const result = next(action)
  return result
}

export const crashReporter: Middleware = store => next => action => {
  try {
    return next(action)
  } catch (err) {
    console.error('Caught an exception!', err)
    Sentry.captureException(err, {
      extra: {
        action,
        state: store.getState(),
      },
    })
    throw err
  }
}
