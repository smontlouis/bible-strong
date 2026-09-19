import { fetch as expoFetch } from 'expo/fetch'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime.web'
import { getResourceAppCheckToken } from '~helpers/resourceAppCheck'
import type { StudyEvent, StudyRequest } from '@bible-strong/ai-contract/contract'
import { readDebugStream, type DebugEntry, type DebugSession } from './trace'

async function authenticatedRequest(
  path: string,
  signal: AbortSignal,
  body?: unknown,
  session?: DebugSession
) {
  if (!__DEV__) throw new Error('DEBUG_ACCESS_DENIED')
  const base = process.env.EXPO_PUBLIC_AI_API_URL,
    user = getCurrentAuthUser()
  if (!base || !user) throw new Error('SIGN_IN_REQUIRED')
  if (session && (session.uid !== user.uid || session.expiresAt <= Date.now()))
    throw new Error('DEBUG_SESSION_REQUIRED')
  const [token, appCheck] = await Promise.all([user.getIdToken(), getResourceAppCheckToken()])
  if (signal.aborted || getCurrentAuthUser()?.uid !== user.uid) throw new Error('INTERRUPTED')
  const response = await expoFetch(`${base.replace(/\/$/, '')}/v1/study-assistant/${path}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Firebase-AppCheck': appCheck,
      ...(session ? { 'X-Assistant-Debug': session.token } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
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
