import { useAtomValue } from 'jotai/react'

import { desktopBootstrap } from '~desktop/bridge'
import {
  WINDOW_CONTROLS_INSET,
  WINDOW_CONTROLS_STRIP_HEIGHT,
  windowFullscreenAtom,
} from '~desktop/windowControls'
import { hasWindowMaterial } from '~desktop/windowMaterial'

import './windowMaterial.css'

/**
 * On macOS the window has no title bar: its buttons sit over the top left of the page
 * (`lib.rs`), and the headers along the top edge drag the window. Windows and Linux keep their
 * own title bar. Tauri drags from an element marked `deep`, except from its buttons, links and
 * fields.
 */
const MAC = desktopBootstrap().platform === 'macos'
const DRAG_REGION = MAC ? { tauriDragRegion: 'deep' } : undefined

/** Room the window buttons take at the top left of the page; none in full screen. */
export const useWindowControlsInset = (): number => {
  const fullscreen = useAtomValue(windowFullscreenAtom)
  return MAC && !fullscreen ? WINDOW_CONTROLS_INSET : 0
}

/** Height of the strip at the sidebar's top that holds the window buttons; none in full screen. */
export const useWindowControlsStripHeight = (): number => {
  const fullscreen = useAtomValue(windowFullscreenAtom)
  return MAC && !fullscreen ? WINDOW_CONTROLS_STRIP_HEIGHT : 0
}

/**
 * A page header drags the window only in the workspace, along the top edge (it leaves room for
 * the sidebar button there): a header in a sheet or a dialog does not.
 */
export const windowDragRegion = (headerInset: number) => (headerInset > 0 ? DRAG_REGION : undefined)

export const sidebarDragRegion = DRAG_REGION

/**
 * On macOS the window is transparent over the system's sidebar material, tinted with the theme
 * by a native view (`windowMaterial.ts`): the shell paints no ground of its own.
 */
export const useWindowMaterial = (): boolean => hasWindowMaterial()
