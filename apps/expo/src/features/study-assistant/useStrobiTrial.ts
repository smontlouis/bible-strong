import { useAtom } from 'jotai/react'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { strobiTrialRequestedAtom } from '~features/onboarding/atom'
import { asksEmailVerification, questionsSpent } from './assistantQuota'
import { ASSISTANT_PATH } from './assistantSheetContext'
import { useAssistantQuota } from './useAssistantQuota'
import type { AssistantSession } from './useAssistantSession'

/**
 * The reader asked to try Strobi during the onboarding: the assistant opens on its own, and once
 * the account has agreed to send its questions to AI providers, it asks the onboarding's
 * question, as soon as the service would answer it (a verified address, a question left today).
 * Closing the assistant before the question could go gives up the trial.
 */
export function useStrobiTrial({
  session,
  open,
  enabled = true,
  openAssistant,
}: {
  session: AssistantSession
  open: boolean
  /**
   * Off, the trial waits: for a signed-in account, and for the onboarding to leave the screen.
   */
  enabled?: boolean
  /** How this platform opens the assistant: its page on native, its window on the Web. */
  openAssistant?: () => void
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [stored, setRequested] = useAtom(strobiTrialRequestedAtom)
  const requested = enabled && stored
  const opened = useRef(false)
  const { ready, busy, send, consent } = session
  // A question the service would refuse waits: for the account's quota to be known, then for the
  // address to be verified, or for tomorrow.
  const quota = useAssistantQuota()
  const held = !quota || asksEmailVerification('', quota) || questionsSpent(quota)

  useEffect(() => {
    if (!requested || !ready || opened.current) return
    opened.current = true
    if (open) return
    if (openAssistant) openAssistant()
    else router.push(ASSISTANT_PATH)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, requested, router])

  useEffect(() => {
    if (!requested || !ready || busy || held || consent.status !== 'granted') return
    setRequested(false)
    void send(t('onboarding.abel.sceneStrobi.question'))
  }, [busy, consent.status, held, ready, requested, send, setRequested, t])

  // Closed before the question could go, the trial ends: the assistant does not open again by itself.
  useEffect(() => {
    if (!requested || !opened.current || open) return
    if (consent.status !== 'granted' || held) setRequested(false)
  }, [consent.status, held, open, requested, setRequested])
}
