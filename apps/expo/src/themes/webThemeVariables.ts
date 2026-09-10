import type { Theme } from './index'

/** Portals outside ScopedTheme must carry the application's tokens explicitly. */
export function webThemeVariables(colors: Theme['colors']): Record<`--color-${string}`, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [
      `--color-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
      value,
    ])
  )
}
