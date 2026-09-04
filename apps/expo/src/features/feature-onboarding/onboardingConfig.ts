import type { TFunction } from 'i18next'
import type { OnboardingConfig } from './types'

export const ONBOARDING_IDS = {
  ANNOTATION_MODE: 'annotation-mode',
} as const

export type OnboardingId = (typeof ONBOARDING_IDS)[keyof typeof ONBOARDING_IDS]

export const getOnboardingConfig = (id: OnboardingId, t: TFunction): OnboardingConfig | null => {
  switch (id) {
    case ONBOARDING_IDS.ANNOTATION_MODE:
      return {
        id: ONBOARDING_IDS.ANNOTATION_MODE,
        steps: [
          {
            title: t('onboarding.annotationMode.step1.title'),
            description: t('onboarding.annotationMode.step1.description'),
          },
          {
            title: t('onboarding.annotationMode.step5.title'),
            description: t('onboarding.annotationMode.step5.description'),
          },
          {
            title: t('onboarding.annotationMode.step2.title'),
            description: t('onboarding.annotationMode.step2.description'),
          },
          {
            title: t('onboarding.annotationMode.step3.title'),
            description: t('onboarding.annotationMode.step3.description'),
          },
        ],
      }
    default:
      return null
  }
}
