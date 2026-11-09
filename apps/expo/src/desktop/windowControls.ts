import { getCurrentWindow } from '@tauri-apps/api/window'
import { atom } from 'jotai'
import { useSetAtom } from 'jotai/react'
import { useEffect } from 'react'

import { desktopBootstrap } from './bridge'

/**
 * Room the macOS window buttons take at the top left of the page: the shell places the first
 * at x 13 and their top at y 16 (`create_main_window` in `lib.rs`); the three span 60 points
 * across and 14 down, then a margin.
 */
export const WINDOW_CONTROLS_INSET = 85
export const WINDOW_CONTROLS_STRIP_HEIGHT = 44

/** In full screen macOS hides the window buttons, and the page takes back their room. */
export const windowFullscreenAtom = atom(false)

export const useDesktopFullscreen = () => {
  const setFullscreen = useSetAtom(windowFullscreenAtom)

  useEffect(() => {
    if (desktopBootstrap().platform !== 'macos') return
    const window = getCurrentWindow()
    const update = () => {
      window
        .isFullscreen()
        .then(setFullscreen)
        .catch(() => {})
    }
    update()
    const unlisten = window.onResized(update)
    return () => {
      void unlisten.then(stop => stop())
    }
  }, [setFullscreen])
}
