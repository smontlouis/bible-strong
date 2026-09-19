import { versions } from '~helpers/bibleVersions'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { resolveStrongNavigationVersionId } from '~helpers/strongBiblePublications'
import { assistantLanguagePreferences } from './languagePreferences'
import { getLanguage } from '~i18n'
import { store } from '~redux/store'
import { fetch as expoFetch } from 'expo/fetch'
import { readStudyStream } from '@bible-strong/ai-contract/stream'
import type { StudyRequest, StudyEvent } from '@bible-strong/ai-contract/contract'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { getResourceAppCheckToken } from '~helpers/resourceAppCheck'
import type { DictationConnection } from './dictationAdapter'
export async function connectAssistantDictation(signal: AbortSignal): Promise<DictationConnection> {
  const base = process.env.EXPO_PUBLIC_AI_API_URL
  const user = getCurrentAuthUser()
  if (!base || !user) throw new Error('SIGN_IN_REQUIRED')
  const [token, appCheck] = await Promise.all([user.getIdToken(), getResourceAppCheckToken()])
  const response = await expoFetch(`${base.replace(/\/$/, '')}/v1/study-assistant/dictation`, {
    method: 'POST',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    headers: { Authorization: `Bearer ${token}`, 'X-Firebase-AppCheck': appCheck },
  })
  if (!response.ok)
    throw new Error(response.status === 429 ? 'DAILY_LIMIT' : 'DICTATION_UNAVAILABLE')
  const session = await response.json()
  const url = new URL(session.url)
  if (
    url.protocol !== 'wss:' ||
    url.origin !== 'wss://ai-gateway.vercel.sh' ||
    url.pathname !== '/v4/ai/transcription-model' ||
    typeof session.token !== 'string' ||
    !/^vcst_[A-Za-z0-9._-]+$/.test(session.token)
  )
    throw new Error('INVALID_DICTATION_SESSION')
  if (signal.aborted || getCurrentAuthUser()?.uid !== user.uid) throw new Error('INTERRUPTED')
  if (
    session.providerOptions != null &&
    (typeof session.providerOptions !== 'object' || Array.isArray(session.providerOptions))
  )
    throw new Error('INVALID_DICTATION_SESSION')
  return {
    socket: new WebSocket(url, ['ai-gateway-transcription.v1', `ai-gateway-auth.${session.token}`]),
    providerOptions: session.providerOptions,
  }
}
export function captureAssistantPreferences(readingBibleVersion?: string) {
  const settings = store.getState().user.bible.settings
  return assistantLanguagePreferences(
    getLanguage(),
    settings.defaultBibleVersion && versions[settings.defaultBibleVersion]
      ? settings.defaultBibleVersion
      : getDefaultBibleVersion(getLanguage()),
    readingBibleVersion,
    resolveStrongNavigationVersionId(settings.defaultStrongBibleVersionId || '') || 'LSG'
  )
}
export async function askAssistant(
  input: StudyRequest,
  signal: AbortSignal,
  onEvent: (event: StudyEvent) => void
) {
  const preferences = {
    ...captureAssistantPreferences(input.readingBibleVersion || input.bibleVersion),
    ...(input.appLanguage ? { appLanguage: input.appLanguage } : {}),
    ...(input.defaultBibleVersion ? { defaultBibleVersion: input.defaultBibleVersion } : {}),
    ...(input.defaultStrongBibleVersion
      ? { defaultStrongBibleVersion: input.defaultStrongBibleVersion }
      : {}),
  }
  const base = process.env.EXPO_PUBLIC_AI_API_URL
  if (!base) throw new Error('AI_UNAVAILABLE')
  const user = getCurrentAuthUser()
  if (!user) throw new Error('SIGN_IN_REQUIRED')
  const [token, appCheck] = await Promise.all([user.getIdToken(), getResourceAppCheckToken()])
  if (signal.aborted) throw new Error('INTERRUPTED')
  const response = await expoFetch(`${base.replace(/\/$/, '')}/v1/study-assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Firebase-AppCheck': appCheck,
    },
    body: JSON.stringify({ ...input, ...preferences }),
    signal,
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('SIGN_IN_REQUIRED')
    if (response.status === 403) throw new Error('BETA_ACCESS_REQUIRED')
    if (response.status === 429) throw new Error('DAILY_LIMIT')
    throw new Error('AI_UNAVAILABLE')
  }
  if (!response.body) throw new Error('INCOMPLETE_STREAM')
  for await (const event of readStudyStream(response.body)) onEvent(event)
}

export async function compactAssistant(
  input: {
    summary: string
    history: import('@bible-strong/ai-contract/contract').HistoryMessage[]
  },
  signal: AbortSignal
): Promise<string> {
  const base = process.env.EXPO_PUBLIC_AI_API_URL,
    user = getCurrentAuthUser()
  if (!base) throw new Error('AI_UNAVAILABLE')
  if (!user) throw new Error('SIGN_IN_REQUIRED')
  const [token, appCheck] = await Promise.all([user.getIdToken(), getResourceAppCheckToken()])
  const response = await expoFetch(`${base.replace(/\/$/, '')}/v1/study-assistant/compact`, {
    method: 'POST',
    signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Firebase-AppCheck': appCheck,
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(response.status === 429 ? 'DAILY_LIMIT' : 'COMPACTION_FAILED')
  const result = await response.json()
  if (
    result.version !== 'memory-2' ||
    typeof result.summary !== 'string' ||
    !result.summary.trim() ||
    result.summary.length > 3000
  )
    throw new Error('COMPACTION_FAILED')
  return result.summary
}
