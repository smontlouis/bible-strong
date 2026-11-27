import type { GestureDemoId } from './demos/gestureDemoIds'

export interface OnboardingStepConfig {
  title: string
  description: string
  /** A gesture the step teaches, drawn above its text. */
  demo?: GestureDemoId
}

export interface OnboardingConfig {
  id: string
  steps: OnboardingStepConfig[]
}

export interface FeatureOnboardingModalState {
  onboardingId: string
}
