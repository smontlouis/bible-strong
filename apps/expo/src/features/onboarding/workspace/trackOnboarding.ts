import { IS_DESKTOP } from '~desktop/isDesktopBuild'
import { trackAnalyticsEvent } from '~helpers/analytics'

/**
 * One step of the onboarding of the Web or the desktop app, reached or left: where readers
 * stop tells which step to rework.
 */
export const trackOnboarding = ({
  flow,
  step,
  action,
}: {
  flow: 'story' | 'tour' | 'invite'
  step: string
  action?: string
}) =>
  void trackAnalyticsEvent('onboarding_step', {
    surface: IS_DESKTOP ? 'desktop' : 'web',
    flow,
    step,
    ...(action ? { action } : {}),
  })
