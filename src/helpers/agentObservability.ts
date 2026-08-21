import * as Sentry from '@sentry/react-native'

type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

type AgentLogArea =
  | 'startup'
  | 'navigation'
  | 'redux'
  | 'error-boundary'
  | 'database'
  | 'sync'
  | 'webview'
  | 'download'
  | 'quality'
  | 'unknown'

export type AgentLogPayload = Record<string, unknown>

export type AgentLogEvent = {
  area: AgentLogArea
  event: string
  level: AgentLogLevel
  payload?: AgentLogPayload
  timestamp: string
}

const MAX_AGENT_LOG_EVENTS = 500
const MAX_CONTEXT_DEPTH = 4
const MAX_CONTEXT_KEYS = 30
const MAX_ARRAY_ITEMS = 20
const MAX_STRING_LENGTH = 500
const PRIVATE_KEY_PATTERN =
  /(?:authorization|cookie|credential|password|secret|token|email|phone|photo|displayname|user(?:id|data)?|uid|document|payload|state|content|note|highlight|bookmark|study|searchtext)/i
const URL_KEY_PATTERN = /(?:url|uri)$/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

declare global {
  var __BIBLE_STRONG_AGENT_LOGS__: AgentLogEvent[] | undefined
}

const getEventBuffer = () => {
  globalThis.__BIBLE_STRONG_AGENT_LOGS__ ??= []
  return globalThis.__BIBLE_STRONG_AGENT_LOGS__
}

const sanitizeString = (value: string, key: string, maxLength = MAX_STRING_LENGTH): string => {
  if (URL_KEY_PATTERN.test(key)) {
    try {
      const url = new URL(value)
      url.search = ''
      url.hash = ''
      value = url.toString()
    } catch {}
  }

  const redacted = value
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted
}

const errorSummary = (error: Error): AgentLogPayload => {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
  return {
    name: error.name,
    message: sanitizeString(error.message, 'errorMessage'),
    ...(code ? { code: sanitizeString(code, 'errorCode') } : {}),
  }
}

const sanitizeValue = (
  value: unknown,
  key: string,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  if (PRIVATE_KEY_PATTERN.test(key)) return '[REDACTED]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return sanitizeString(value, key)
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return '[function]'
  if (value instanceof Error) return errorSummary(value)
  if (value instanceof Date) return value.toISOString()
  if (depth >= MAX_CONTEXT_DEPTH) return '[max-depth]'
  if (typeof value !== 'object') return typeof value
  if (seen.has(value)) return '[circular]'

  seen.add(value)
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item, index) => sanitizeValue(item, `${key}.${index}`, depth + 1, seen))
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} items]`)
    return items
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_CONTEXT_KEYS)
      .map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey, depth + 1, seen),
      ])
  )
}

export const sanitizeDiagnosticPayload = (
  payload: AgentLogPayload | undefined
): AgentLogPayload | undefined => {
  if (!payload) return undefined
  return sanitizeValue(payload, 'diagnostic', 0, new WeakSet()) as AgentLogPayload
}

const normalizeError = (error: unknown, fallbackMessage: string): Error => {
  const sourceError = error instanceof Error ? error : undefined
  const sourceMessage =
    sourceError?.message ??
    (error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message
      : error)
  const message = typeof sourceMessage === 'string' ? sourceMessage : fallbackMessage
  const normalized = new Error(sanitizeString(message, 'errorMessage'))

  if (sourceError) {
    normalized.name = sanitizeString(sourceError.name, 'errorName')
    if (sourceError.stack) normalized.stack = sanitizeString(sourceError.stack, 'errorStack', 8_000)
    if ('code' in sourceError && typeof sourceError.code === 'string') {
      ;(normalized as Error & { code: string }).code = sanitizeString(sourceError.code, 'errorCode')
    }
  }

  return normalized
}

const sentryBreadcrumbLevel = (level: AgentLogLevel) => {
  if (level === 'warn') return 'warning' as const
  if (level === 'fatal') return 'fatal' as const
  return level
}

const writeAgentLog = (
  level: AgentLogLevel,
  area: AgentLogArea,
  event: string,
  payload?: AgentLogPayload
) => {
  const sanitizedPayload = sanitizeDiagnosticPayload(payload)

  try {
    Sentry.addBreadcrumb({
      category: `bible-strong.${area}`,
      message: event,
      level: sentryBreadcrumbLevel(level),
      data: sanitizedPayload,
    })
  } catch {}

  if (typeof __DEV__ === 'undefined' || !__DEV__) return

  const entry: AgentLogEvent = {
    area,
    event,
    level,
    payload: sanitizedPayload,
    timestamp: new Date().toISOString(),
  }

  const buffer = getEventBuffer()
  buffer.push(entry)
  if (buffer.length > MAX_AGENT_LOG_EVENTS) {
    buffer.splice(0, buffer.length - MAX_AGENT_LOG_EVENTS)
  }

  // Keep agent logs in the in-memory buffer without duplicating them in Metro logs.
}

export const getAgentLogEvents = () => getEventBuffer()

export const appLogger = {
  debug: (area: AgentLogArea, event: string, payload?: AgentLogPayload) =>
    writeAgentLog('debug', area, event, payload),
  info: (area: AgentLogArea, event: string, payload?: AgentLogPayload) =>
    writeAgentLog('info', area, event, payload),
  warn: (area: AgentLogArea, event: string, payload?: AgentLogPayload) =>
    writeAgentLog('warn', area, event, payload),
  error: (area: AgentLogArea, event: string, payload?: AgentLogPayload) =>
    writeAgentLog('error', area, event, payload),
  fatal: (area: AgentLogArea, event: string, payload?: AgentLogPayload) =>
    writeAgentLog('fatal', area, event, payload),
  captureError: (
    area: AgentLogArea,
    event: string,
    error: unknown,
    payload?: AgentLogPayload,
    level: 'error' | 'fatal' = 'error'
  ) => {
    writeAgentLog(level, area, event, { ...payload, error })
    const normalizedError = normalizeError(error, event)
    const context = sanitizeDiagnosticPayload({ ...payload, error: errorSummary(normalizedError) })

    try {
      Sentry.withScope(scope => {
        scope.setLevel(level)
        scope.setTag('diagnostic.area', area)
        scope.setTag('diagnostic.event', event)
        const errorCode =
          (payload?.errorCode && typeof payload.errorCode === 'string'
            ? payload.errorCode
            : 'code' in normalizedError && typeof normalizedError.code === 'string'
              ? normalizedError.code
              : undefined) ?? undefined
        if (errorCode) scope.setTag('diagnostic.error_code', sanitizeString(errorCode, 'errorCode'))
        if (context) scope.setContext('diagnostic', context)
        Sentry.captureException(normalizedError)
      })
    } catch {}
  },
  measure: async <T>(
    area: AgentLogArea,
    event: string,
    callback: () => Promise<T>,
    payload?: AgentLogPayload
  ): Promise<T> => {
    const startedAt = Date.now()
    appLogger.debug(area, `${event}.started`, payload)

    try {
      const result = await callback()
      appLogger.info(area, `${event}.completed`, {
        ...payload,
        durationMs: Date.now() - startedAt,
      })
      return result
    } catch (error) {
      appLogger.captureError(area, `${event}.failed`, error, {
        ...payload,
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  },
}

export const agentLog = writeAgentLog
