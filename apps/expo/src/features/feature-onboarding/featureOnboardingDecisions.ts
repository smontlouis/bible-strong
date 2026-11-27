import { LATER_ONBOARDING_IDS, ONBOARDING_IDS, type OnboardingId } from './onboardingConfig'

/**
 * The explanations seen once the later ones are decided for this device. A reader who had been
 * through the app's introduction before these explanations existed knows the places they show:
 * they are all marked seen. A reader who has not is new, and gets each in its place. Returns
 * null when there is nothing left to decide.
 */
export function decideLaterOnboardings({
  decided,
  introductionCompleted,
  completed,
}: {
  decided: boolean
  introductionCompleted: boolean
  completed: string[]
}): string[] | null {
  if (decided) return null
  if (!introductionCompleted) return completed
  return [...completed, ...LATER_ONBOARDING_IDS.filter(id => !completed.includes(id))]
}

/** The time left between two explanations, counted from the closing of the first. */
export const FEATURE_ONBOARDING_GAP_MS = 60_000

export type FeatureOnboardingSituation = {
  completed: string[]
  /** When the last explanation was closed in this run of the app, if one was. */
  lastClosedAt: number | null
  now: number
  /** The app's introduction fills the screen. */
  introductionOnScreen: boolean
  /** An explanation is open already. */
  modalOpen: boolean
  platform: string
}

/**
 * Whether an explanation may open now: not seen yet, and none closed in the last minute, so that
 * two never follow each other. The later ones teach touch gestures, which the Web and the desktop
 * app teach with their own tour.
 */
export function canShowFeatureOnboarding(id: OnboardingId, situation: FeatureOnboardingSituation) {
  if (situation.completed.includes(id)) return false
  if (situation.introductionOnScreen || situation.modalOpen) return false
  if (
    situation.lastClosedAt !== null &&
    situation.now - situation.lastClosedAt < FEATURE_ONBOARDING_GAP_MS
  ) {
    return false
  }
  if (situation.platform === 'web' && id !== ONBOARDING_IDS.ANNOTATION_MODE) return false
  return true
}
