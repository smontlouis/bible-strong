import { useAtom } from 'jotai/react'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { strobiTrialRequestedAtom } from '~features/onboarding/atom'
import { ASSISTANT_PATH } from './assistantSheetContext'
import type { AssistantSession } from './useAssistantSession'

/**
 * The reader asked to try Strobi during the onboarding: the assistant opens on its own, and once
 * the account has agreed to send its questions to AI providers, it asks the onboarding's
 * question. Closing the assistant before agreeing gives up the trial.
 */
export function useStrobiTrial({ session, open }: { session: AssistantSession; open: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [requested, setRequested] = useAtom(strobiTrialRequestedAtom)
  const opened = useRef(false)
  const { ready, busy, send, consent } = session

  useEffect(() => {
    if (!requested || !ready || opened.current) return
    opened.current = true
    if (!open) router.push(ASSISTANT_PATH)
  }, [open, ready, requested, router])

  useEffect(() => {
    if (!requested || !ready || busy || consent.status !== 'granted') return
    setRequested(false)
    void send(t('onboarding.abel.sceneStrobi.question'))
  }, [busy, consent.status, ready, requested, send, setRequested, t])

  useEffect(() => {
    if (requested && opened.current && !open && consent.status !== 'granted') setRequested(false)
  }, [consent.status, open, requested, setRequested])
}
