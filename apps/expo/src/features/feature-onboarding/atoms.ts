import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { FeatureOnboardingModalState } from './types'

// Persisted atom tracking completed onboarding IDs
export const completedOnboardingsAtom = atomWithAsyncStorage<string[]>('completedOnboardings', [])

// Whether a reader who arrived with these explanations already had the app's introduction behind
// them: decided once, on the first launch that has them (see decideLaterOnboardings).
export const laterOnboardingsDecidedAtom = atomWithAsyncStorage<boolean>(
  'laterOnboardingsDecided',
  false
)

// One explanation per session at most: the next one waits for the next time its place is used.
export const featureOnboardingShownThisSessionAtom = atom(false)

// Onboarding navigation state atoms
export const onboardingCurrentStepAtom = atom(0)

// Action atom to mark an onboarding as completed
export const completeOnboardingAtom = atom(null, (get, set, onboardingId: string) => {
  const completed = get(completedOnboardingsAtom)
  if (!completed.includes(onboardingId)) {
    set(completedOnboardingsAtom, [...completed, onboardingId])
  }
})

// Action atom to reset an onboarding (for testing)
export const resetOnboardingAtom = atom(null, (get, set, onboardingId: string) => {
  const completed = get(completedOnboardingsAtom)
  set(
    completedOnboardingsAtom,
    completed.filter(id => id !== onboardingId)
  )
})

// Modal state atom - false when closed, or contains the onboarding config when open
export const featureOnboardingModalAtom = atom<FeatureOnboardingModalState | false>(false)

// Hook to check if an onboarding has been completed
export const useIsOnboardingCompleted = (onboardingId: string): boolean => {
  const completed = useAtomValue(completedOnboardingsAtom)
  return completed.includes(onboardingId)
}
