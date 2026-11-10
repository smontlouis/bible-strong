import { useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import type { StudyQuota } from '@bible-strong/ai-contract/contract'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import FireAuth from '~helpers/FireAuth'
import useLogin from '~helpers/useLogin'

import { assistantQuotaAtom, currentQuota } from './assistantQuota'
import { fetchAssistantQuota } from './client'

let loading: Promise<unknown> | null = null

/** Reads the quota again; a read already under way serves. A failure leaves nothing to show. */
export const refreshAssistantQuota = () => {
  if (loading) return loading
  const controller = new AbortController()
  loading = fetchAssistantQuota(controller.signal)
    .catch(() => {})
    .finally(() => {
      loading = null
    })
  return loading
}

/**
 * Keeps the quota of the signed-in account current while the assistant is open: when it opens,
 * when Premium changes on this device, after an answer the server failed (it gives the question
 * back), and when the day's questions come back. Mounted once, where the session lives.
 */
export function useAssistantQuotaSync({
  active,
  busy,
  error,
}: {
  active: boolean
  busy: boolean
  error: string
}) {
  const { isLogged, user } = useLogin()
  const uid = isLogged ? user.id : null
  const premium = useAtomValue(premiumStatusAtom).kind
  const state = useAtomValue(assistantQuotaAtom)
  const quota = currentQuota(state, uid, new Date())

  useEffect(() => {
    if (active && uid) void refreshAssistantQuota()
  }, [active, uid, premium])

  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy && active && error && error !== 'assistant.limit')
      void refreshAssistantQuota()
    wasBusy.current = busy
  }, [busy, error, active])

  const resetsAt = quota?.kind === 'daily' ? quota.resetsAt : null
  useEffect(() => {
    if (!active || !resetsAt) return
    const timer = setTimeout(
      () => void refreshAssistantQuota(),
      Math.max(0, Date.parse(resetsAt) - Date.now()) + 1000
    )
    return () => clearTimeout(timer)
  }, [active, resetsAt])
}

/**
 * What the signed-in account may still ask today, as far as the app knows. Premium on this
 * device counts at once, before the service has heard of the purchase.
 */
export function useAssistantQuota(): StudyQuota | null {
  const { isLogged, user } = useLogin()
  const premium = useAtomValue(premiumStatusAtom)
  const state = useAtomValue(assistantQuotaAtom)
  // Re-render when the day's questions come back, so a used-up count does not linger.
  const [now, setNow] = useState(() => new Date())
  const quota = currentQuota(state, isLogged ? user.id : null, now)
  const resetsAt = quota?.kind === 'daily' ? quota.resetsAt : null
  useEffect(() => {
    if (!resetsAt) return
    const timer = setTimeout(
      () => setNow(new Date()),
      Math.max(0, Date.parse(resetsAt) - Date.now()) + 500
    )
    return () => clearTimeout(timer)
  }, [resetsAt])
  if (premium.kind === 'active') return { kind: 'unlimited' }
  return quota
}

/**
 * While the assistant asks for a verified address, the account is read again every 5 seconds;
 * once the address is verified, the quota is read again with a token that says so.
 */
export function useEmailVerificationWatch(active: boolean) {
  useEffect(() => {
    if (!active) return
    let stopped = false
    const interval = setInterval(() => {
      void FireAuth.checkEmailVerification().then(verified => {
        if (!verified || stopped) return
        stopped = true
        clearInterval(interval)
        void refreshAssistantQuota()
      })
    }, 5000)
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [active])
}
