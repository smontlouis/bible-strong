import { isEnvironmentFlagEnabled } from './environmentFlags'

export { isEnvironmentFlagEnabled } from './environmentFlags'

/**
 * Keeps the development-only entry point opt-in and explicit. Expo exposes
 * EXPO_PUBLIC_* variables to the JavaScript bundle at build time.
 */
export const isPlaygroundEnabled = isEnvironmentFlagEnabled(process.env.EXPO_PUBLIC_PLAYGROUND)
