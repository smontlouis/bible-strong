import { isEnvironmentFlagEnabled } from './environmentFlags'

export { isEnvironmentFlagEnabled } from './environmentFlags'

/**
 * Keeps the development-only entry point opt-in and explicit. Expo exposes
 * EXPO_PUBLIC_* variables to the JavaScript bundle at build time.
 */
export const isPlaygroundEnabled = isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_PLAYGROUND)

/**
 * Replays onboarding once per app session without deleting installed resources
 * or changing the persisted completion state.
 */
export const isOnboardingForced =
  __DEV__ && isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_FORCE_ONBOARDING)
