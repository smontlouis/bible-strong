import { fetch as expoFetch } from 'expo/fetch'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime.web'
import type { HistoryMessage, StudyEvent, StudyRequest } from '@bible-strong/ai-contract/contract'
import { assistantAuthHeaders } from '../assistantAuthHeaders'
import { parseDebugEntry, readDebugStream, type DebugEntry, type DebugSession } from './trace'

async function authenticatedRequest(
  path: string,
  signal: AbortSignal,
  body?: unknown,
  session?: DebugSession,
  /** Receives the error body before the failure is thrown (a failed compaction carries its trace). */
  onErrorBody?: (body: Record<string, unknown>) => void
) {
  if (!__DEV__) throw new Error('DEBUG_ACCESS_DENIED')
  const base = process.env.EXPO_PUBLIC_AI_API_URL,
    user = getCurrentAuthUser()
  if (!base || !user) throw new Error('SIGN_IN_REQUIRED')
  if (session && (session.uid !== user.uid || session.expiresAt <= Date.now()))
    throw new Error('DEBUG_SESSION_REQUIRED')
  const auth = await assistantAuthHeaders(user)
  if (signal.aborted || getCurrentAuthUser()?.uid !== user.uid) throw new Error('INTERRUPTED')
  const response = await expoFetch(`${base.replace(/\/$/, '')}/v1/study-assistant/${path}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(session ? { 'X-Assistant-Debug': session.token } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    onErrorBody?.(error)
    throw new Error(typeof error.code === 'string' ? error.code : 'DEBUG_UNAVAILABLE')
  }
  if (signal.aborted || getCurrentAuthUser()?.uid !== user.uid) throw new Error('INTERRUPTED')
  return { response, uid: user.uid }
}
export async function startDebugSession(signal: AbortSignal): Promise<DebugSession> {
  const { response, uid } = await authenticatedRequest('debug-session', signal)
  const result = await response.json()
  if (
    typeof result.token !== 'string' ||
    result.token.length > 4096 ||
    typeof result.expiresAt !== 'number' ||
    result.expiresAt <= Date.now() ||
    result.expiresAt > Date.now() + 901000
  )
    throw new Error('DEBUG_UNAVAILABLE')
  return { token: result.token, expiresAt: result.expiresAt, uid }
}
export async function askDebugAssistant(
  input: StudyRequest,
  signal: AbortSignal,
  onEvent: (event: StudyEvent) => void,
  session: DebugSession,
  onDebug: (entry: DebugEntry) => void
) {
  const { response } = await authenticatedRequest('debug-chat', signal, input, session)
  if (!response.body) throw new Error('INCOMPLETE_STREAM')
  await readDebugStream(response.body, onEvent, onDebug)
}
/** The diagnostics of a memory compaction come back with its summary, or with its failure. */
export async function compactDebugAssistant(
  input: { summary: string; history: HistoryMessage[] },
  signal: AbortSignal,
  session: DebugSession,
  onDebug: (entry: DebugEntry) => void
): Promise<string> {
  const forward = (body: Record<string, unknown>) => {
    if (!Array.isArray(body.debug) || body.debug.length > 251) return
    for (const entry of body.debug) onDebug(parseDebugEntry(entry))
  }
  const { response } = await authenticatedRequest(
    'debug-compact',
    AbortSignal.any([signal, AbortSignal.timeout(50000)]),
    input,
    session,
    error => {
      try {
        forward(error)
      } catch {}
    }
  ).catch(error => {
    const code = error instanceof Error ? error.message : ''
    throw new Error(
      ['SIGN_IN_REQUIRED', 'DAILY_LIMIT', 'INTERRUPTED'].includes(code) ? code : 'COMPACTION_FAILED'
    )
  })
  const result = await response.json()
  forward(result)
  if (
    result.version !== 'memory-2' ||
    typeof result.summary !== 'string' ||
    !result.summary.trim() ||
    result.summary.length > 3000
  )
    throw new Error('COMPACTION_FAILED')
  return result.summary
}
