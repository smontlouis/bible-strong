import { useAtomValue } from 'jotai/react'

import { desktopBootstrap } from '~desktop/bridge'
import { WINDOW_CONTROLS_INSET, windowFullscreenAtom } from '~desktop/windowControls'

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

/**
 * A page header drags the window only in the workspace, along the top edge (it leaves room for
 * the sidebar button there): a header in a sheet or a dialog does not.
 */
export const windowDragRegion = (headerInset: number) => (headerInset > 0 ? DRAG_REGION : undefined)

export const sidebarDragRegion = DRAG_REGION
