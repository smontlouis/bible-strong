/**
 * The desktop app (ADR-0107): the web export run by the Tauri shell, with Offline copies.
 * Inlined at build time, so the public web bundle drops every desktop branch. Apart from
 * `isDesktop.ts`, which needs React Native, so that modules without it can ask too.
 */
export const IS_DESKTOP = process.env.EXPO_PUBLIC_DESKTOP === '1'
