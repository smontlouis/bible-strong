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

type AgentLogPayload = Record<string, unknown>

export type AgentLogEvent = {
  area: AgentLogArea
  event: string
  level: AgentLogLevel
  payload?: AgentLogPayload
  timestamp: string
}

const MAX_AGENT_LOG_EVENTS = 500
const AGENT_LOG_PREFIX = '[AgentLog]'

declare global {
  var __BIBLE_STRONG_AGENT_LOGS__: AgentLogEvent[] | undefined
}

const getEventBuffer = () => {
  globalThis.__BIBLE_STRONG_AGENT_LOGS__ ??= []
  return globalThis.__BIBLE_STRONG_AGENT_LOGS__
}

const sanitizePayload = (payload: AgentLogPayload | undefined): AgentLogPayload | undefined => {
  if (!payload) return undefined

  return Object.entries(payload).reduce<AgentLogPayload>((result, [key, value]) => {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
      return result
    }

    if (typeof value === 'function') {
      result[key] = '[function]'
      return result
    }

    result[key] = value
    return result
  }, {})
}

const writeAgentLog = (
  level: AgentLogLevel,
  area: AgentLogArea,
  event: string,
  payload?: AgentLogPayload
) => {
  if (!__DEV__) return

  const entry: AgentLogEvent = {
    area,
    event,
    level,
    payload: sanitizePayload(payload),
    timestamp: new Date().toISOString(),
  }

  const buffer = getEventBuffer()
  buffer.push(entry)
  if (buffer.length > MAX_AGENT_LOG_EVENTS) {
    buffer.splice(0, buffer.length - MAX_AGENT_LOG_EVENTS)
  }

  const serialized = JSON.stringify(entry)

  if (level === 'error' || level === 'fatal') {
    console.error(AGENT_LOG_PREFIX, serialized)
    return
  }

  if (level === 'warn') {
    console.warn(AGENT_LOG_PREFIX, serialized)
    return
  }

  console.log(AGENT_LOG_PREFIX, serialized)
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
      appLogger.error(area, `${event}.failed`, {
        ...payload,
        durationMs: Date.now() - startedAt,
        error,
      })
      throw error
    }
  },
}

export const agentLog = writeAgentLog
