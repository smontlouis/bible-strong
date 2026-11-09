import { colorWithOpacity } from '~themes/colorValues'

import { desktopBootstrap } from './bridge'

/**
 * On macOS the window is transparent over the system's sidebar material, and a native view
 * lays the theme's canvas over it (`material.rs`): see-through enough for the blurred desktop to
 * show and opaque enough for each theme to keep its hue, where a grey material beside a sepia
 * page would clash. The dark material shows through more than the light one, so dark themes lay
 * more of their ground. The page paints nothing there: WebKit redrew a tint the page painted
 * whenever an animated layer came or went, and it flickered.
 */
export const hasWindowMaterial = () => desktopBootstrap().platform === 'macos'

const MATERIAL_TINT_OPACITY = { light: 0.4, dark: 0.65 }

export const materialTint = (canvas: string, dark: boolean) =>
  colorWithOpacity(canvas, MATERIAL_TINT_OPACITY[dark ? 'dark' : 'light'])
