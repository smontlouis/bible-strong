import { isEnvironmentFlagEnabled } from './environmentFlags'

export { isEnvironmentFlagEnabled } from './environmentFlags'

/**
 * Keeps the development-only entry point opt-in and explicit. Expo exposes
 * EXPO_PUBLIC_* variables to the JavaScript bundle at build time.
 */
export const isPlaygroundEnabled = isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_PLAYGROUND)

/**
 * Checks for and applies an EAS Update when the full app starts.
 * Disabled by default so each build profile must opt in explicitly.
 */
export const areAutomaticUpdatesEnabled = isEnvironmentFlagEnabled(
  process.env.EXPO_PUBLIC_AUTOMATIC_UPDATES
)

/**
 * Replays onboarding once per app session without deleting installed resources
 * or changing the persisted completion state.
 */
export const isOnboardingForced =
  __DEV__ && isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_FORCE_ONBOARDING)

/**
 * Makes development builds behave as if Internet connectivity were unavailable.
 * This affects the app's connectivity state; it is not a network firewall.
 */
export const isOfflineModeForced =
  __DEV__ && isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_FORCE_OFFLINE)
