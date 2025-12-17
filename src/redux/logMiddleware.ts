import * as Sentry from '@sentry/react-native'

export const logger = (store: any) => (next: any) => (action: any) => {
  Sentry.addBreadcrumb({
    category: 'Dispatch',
    message: action.type,
    data: action,
  })
  if (__DEV__ && typeof action !== 'function') {
    console.log('redux - ', action.type)
  }

  const result = next(action)
  return result
}

export const crashReporter = (store: any) => (next: any) => (action: any) => {
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
