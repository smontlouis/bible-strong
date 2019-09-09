import Sentry from 'sentry-expo'

export const logger = store => next => action => {
  Sentry.captureBreadcrumb({
    category: 'Dispatch',
    message: action.type,
    data: action
  })

  const result = next(action)
  return result
}

export const crashReporter = store => next => action => {
  try {
    return next(action)
  } catch (err) {
    console.error('Caught an exception!', err)
    Sentry.captureException(err, {
      extra: {
        action,
        state: store.getState()
      }
    })
    throw err
  }
}
