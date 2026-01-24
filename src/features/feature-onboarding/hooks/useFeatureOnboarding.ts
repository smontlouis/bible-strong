import { useAtomValue, useSetAtom } from 'jotai/react'
import {
  completedOnboardingsAtom,
  completeOnboardingAtom,
  featureOnboardingModalAtom,
  resetOnboardingAtom,
} from '../atoms'
import type { OnboardingId } from '../config'

export const useFeatureOnboarding = () => {
  const completedOnboardings = useAtomValue(completedOnboardingsAtom)
  const completeOnboarding = useSetAtom(completeOnboardingAtom)
  const resetOnboarding = useSetAtom(resetOnboardingAtom)
  const setModalState = useSetAtom(featureOnboardingModalAtom)

  const shouldShow = (id: OnboardingId): boolean => {
    return !completedOnboardings.includes(id)
  }

  // Shows onboarding if not already completed
  // Call this AFTER triggering the action to explain what the user just did
  const triggerIfNeeded = (id: OnboardingId): boolean => {
    if (shouldShow(id)) {
      setModalState({ onboardingId: id })
      return true
    }
    return false
  }

  // Force show onboarding (for testing or re-showing)
  const forceShow = (id: OnboardingId): void => {
    setModalState({ onboardingId: id })
  }

  const markCompleted = (id: OnboardingId): void => {
    completeOnboarding(id)
  }

  const reset = (id: OnboardingId): void => {
    resetOnboarding(id)
  }

  return {
    shouldShow,
    triggerIfNeeded,
    forceShow,
    markCompleted,
    reset,
  }
}
