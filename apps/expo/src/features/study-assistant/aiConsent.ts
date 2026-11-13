import { useEffect, useState } from 'react'
import {
  deleteAssistantConsent,
  observeAssistantConsent,
  saveAssistantConsent,
} from '~helpers/assistantConsentFirestore'

/**
 * The version of what the reader agreed to share with third-party AI providers (App Store
 * rule 5.1.2(i)). Raise it when the consent text says something new: data of another kind, a
 * new kind of recipient. The agreement is asked again then.
 */
export const AI_CONSENT_VERSION = 1

export type AiConsentStatus = 'loading' | 'granted' | 'missing'

/** Whether a stored agreement covers the current text. */
export function consentStatusOf(data: unknown): Exclude<AiConsentStatus, 'loading'> {
  if (!data || typeof data !== 'object') return 'missing'
  const version = (data as { version?: unknown }).version
  return typeof version === 'number' && version >= AI_CONSENT_VERSION ? 'granted' : 'missing'
}

// The last answer per account, so that reopening the assistant does not flash the request.
const known = new Map<string, Exclude<AiConsentStatus, 'loading'>>()

/**
 * The account's agreement to send its questions to third-party AI providers, kept with the
 * account so that it holds on every device. Nothing reaches the assistant before it.
 */
export function useAiConsent(account: string | null | undefined) {
  const [status, setStatus] = useState<AiConsentStatus>(
    () => (account && known.get(account)) || 'loading'
  )
  useEffect(() => {
    if (!account) {
      setStatus('missing')
      return
    }
    setStatus(known.get(account) || 'loading')
    return observeAssistantConsent(
      account,
      data => {
        const next = consentStatusOf(data)
        known.set(account, next)
        setStatus(next)
      },
      // Unreadable, it is asked again: agreeing twice does no harm, sending without it would.
      () => setStatus('missing')
    )
  }, [account])
  const set = (next: Exclude<AiConsentStatus, 'loading'>) => {
    if (!account) return Promise.resolve()
    known.set(account, next)
    setStatus(next)
    return next === 'granted'
      ? saveAssistantConsent(account, AI_CONSENT_VERSION, Date.now())
      : deleteAssistantConsent(account)
  }
  return {
    status,
    accept: () => set('granted'),
    withdraw: () => set('missing'),
  }
}

export type AiConsent = ReturnType<typeof useAiConsent>
