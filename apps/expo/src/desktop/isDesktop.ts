import { Platform } from 'react-native'

/**
 * The desktop app (ADR-0107): the web export run by the Tauri shell, with Offline copies.
 * Inlined at build time, so the public web bundle drops every desktop branch.
 */
export const IS_DESKTOP = process.env.EXPO_PUBLIC_DESKTOP === '1'

/** iOS, Android and the desktop app install Offline copies; the browser reads online only. */
export const supportsOfflineCopies = Platform.OS !== 'web' || IS_DESKTOP

/** The browser build, without the desktop app: what most `Platform.OS === 'web'` gates meant. */
export const IS_BROWSER = Platform.OS === 'web' && !IS_DESKTOP
