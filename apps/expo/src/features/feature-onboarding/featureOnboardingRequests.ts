import { getDefaultStore } from 'jotai/vanilla'
import { Platform } from 'react-native'
import { isOnboardingCompletedAtom, onboardingOnScreenAtom } from '~features/onboarding/atom'
import {
  completedOnboardingsAtom,
  featureOnboardingModalAtom,
  lastFeatureOnboardingClosedAtAtom,
  laterOnboardingsDecidedAtom,
} from './atoms'
import {
  canShowFeatureOnboarding,
  decideLaterOnboardings,
  type FeatureOnboardingSituation,
} from './featureOnboardingDecisions'
import type { OnboardingId } from './onboardingConfig'

/** Records the decision on the first launch that has the later explanations. */
export function settleLaterOnboardings() {
  const store = getDefaultStore()
  const completed = decideLaterOnboardings({
    decided: store.get(laterOnboardingsDecidedAtom),
    introductionCompleted: store.get(isOnboardingCompletedAtom),
    completed: store.get(completedOnboardingsAtom),
  })
  if (!completed) return
  store.set(completedOnboardingsAtom, completed)
  store.set(laterOnboardingsDecidedAtom, true)
}

const readSituation = (): FeatureOnboardingSituation => {
  const store = getDefaultStore()
  return {
    completed: store.get(completedOnboardingsAtom),
    lastClosedAt: store.get(lastFeatureOnboardingClosedAtAtom),
    now: Date.now(),
    introductionOnScreen: store.get(onboardingOnScreenAtom),
    modalOpen: Boolean(store.get(featureOnboardingModalAtom)),
    platform: Platform.OS,
  }
}

const pending = new Map<OnboardingId, ReturnType<typeof setTimeout>>()

/**
 * Opens an explanation of the place the reader just used, if they have not seen it. Called after
 * the action: the delay lets what the action opens settle first. Checked again when it elapses.
 */
export function requestFeatureOnboarding(id: OnboardingId, { delayMs = 0 } = {}) {
  // A selection restored at launch can ask before the modal has settled the later explanations.
  settleLaterOnboardings()
  if (!canShowFeatureOnboarding(id, readSituation())) return
  if (pending.has(id)) return
  const open = () => {
    pending.delete(id)
    if (!canShowFeatureOnboarding(id, readSituation())) return
    getDefaultStore().set(featureOnboardingModalAtom, { onboardingId: id })
  }
  if (delayMs <= 0) {
    open()
    return
  }
  pending.set(id, setTimeout(open, delayMs))
}

/** Opens an explanation again, from the settings, whatever was seen. */
export function replayFeatureOnboarding(id: OnboardingId) {
  getDefaultStore().set(featureOnboardingModalAtom, { onboardingId: id })
}
