export interface OnboardingStepConfig {
  title: string
  description: string
}

export interface OnboardingConfig {
  id: string
  steps: OnboardingStepConfig[]
}

export interface FeatureOnboardingModalState {
  onboardingId: string
}
