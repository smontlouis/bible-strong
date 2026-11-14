import { useAtomValue } from 'jotai/react'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import useLogin from '~helpers/useLogin'
import { onboardingFinishedAtom, strobiTrialRequestedAtom } from './atom'

/**
 * A reader who asked to try Strobi during the onboarding is led to sign in once it closes: the
 * assistant needs an account. Signed in, the assistant opens on its own with the question of the
 * onboarding (see `useStrobiTrial`).
 */
export default function StrobiTrialHandoff() {
  const requested = useAtomValue(strobiTrialRequestedAtom)
  const finished = useAtomValue(onboardingFinishedAtom)
  const { isLogged } = useLogin()
  const router = useRouter()
  const prompted = useRef(false)

  useEffect(() => {
    if (!requested || !finished || isLogged || prompted.current) return
    prompted.current = true
    router.push('/login?strobi=1')
  }, [finished, isLogged, requested, router])

  return null
}
