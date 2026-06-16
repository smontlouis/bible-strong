import * as Sentry from '@sentry/react-native'
import type { Middleware } from '@reduxjs/toolkit'
import { appLogger } from '~helpers/agentObservability'

type ReduxActionLike = {
  type: string
  payload?: unknown
  meta?: unknown
  error?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isReduxAction = (action: unknown): action is ReduxActionLike =>
  !!action && typeof action === 'object' && 'type' in action

const summarizeValue = (value: unknown): unknown => {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 160)}...` : value
  if (Array.isArray(value)) return { type: 'array', length: value.length }
  if (isRecord(value)) return { type: 'object', keys: Object.keys(value).slice(0, 20) }
  return typeof value
}

const getBreadcrumbData = (action: unknown) => {
  if (!isReduxAction(action)) return { actionType: 'unknown' }

  return {
    actionType: action.type,
    payload: summarizeValue(action.payload),
    meta: summarizeValue(action.meta),
    error: summarizeValue(action.error),
  }
}

const getStateSummary = (state: unknown) => {
  if (!isRecord(state)) return summarizeValue(state)

  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, summarizeValue(value)])
  )
}

export const logger: Middleware = _store => next => action => {
  Sentry.addBreadcrumb({
    category: 'Dispatch',
    message: isReduxAction(action) ? action.type : 'unknown',
    data: getBreadcrumbData(action),
  })
  if (__DEV__ && isReduxAction(action)) {
    appLogger.debug('redux', 'action.dispatched', { actionType: action.type })
    console.log('[Redux]', action.type)
  }

  const result = next(action)
  return result
}

export const crashReporter: Middleware = store => next => action => {
  try {
    return next(action)
  } catch (err) {
    appLogger.fatal('redux', 'middleware.crash', { error: err })
    console.error('Caught an exception!', err)
    Sentry.captureException(err, {
      extra: {
        action: getBreadcrumbData(action),
        state: getStateSummary(store.getState()),
      },
    })
    throw err
  }
}
