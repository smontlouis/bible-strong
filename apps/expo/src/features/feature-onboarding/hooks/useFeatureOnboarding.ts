import { useAtomValue, useSetAtom } from 'jotai/react'
import { completedOnboardingsAtom, completeOnboardingAtom, resetOnboardingAtom } from '../atoms'
import { replayFeatureOnboarding, requestFeatureOnboarding } from '../featureOnboardingRequests'
import { OnboardingId } from '../onboardingConfig'

export const useFeatureOnboarding = () => {
  const completedOnboardings = useAtomValue(completedOnboardingsAtom)
  const completeOnboarding = useSetAtom(completeOnboardingAtom)
  const resetOnboarding = useSetAtom(resetOnboardingAtom)

  const shouldShow = (id: OnboardingId): boolean => {
    return !completedOnboardings.includes(id)
  }

  // Shows the onboarding if it was not seen and none was closed in the last minute.
  // Call this AFTER triggering the action to explain what the user just did.
  const triggerIfNeeded = (id: OnboardingId, options?: { delayMs?: number }) =>
    requestFeatureOnboarding(id, options)

  // Force show onboarding (from the settings, or for testing)
  const forceShow = (id: OnboardingId): void => replayFeatureOnboarding(id)

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
