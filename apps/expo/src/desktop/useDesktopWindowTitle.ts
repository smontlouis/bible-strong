import { getCurrentWindow } from '@tauri-apps/api/window'
import { atom } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { useEffect } from 'react'

import { appLogger } from '~helpers/agentObservability'
import { activeTabIndexAtom, tabsAtom } from '~state/tabs'

const APP_NAME = 'Bible Strong'

const activeTabTitleAtom = atom(get => get(tabsAtom)[get(activeTabIndexAtom)]?.title)

/** « Jean 3 — Bible Strong », or the app's name alone without a titled tab. */
export const desktopWindowTitle = (tabTitle: string | undefined) => {
  const title = tabTitle?.trim()
  return title ? `${title} — ${APP_NAME}` : APP_NAME
}

/**
 * The window is titled after the active tab, for what the system shows of it: Mission Control,
 * the Window menu, Alt-Tab and the taskbar.
 */
export const useDesktopWindowTitle = () => {
  const title = desktopWindowTitle(useAtomValue(activeTabTitleAtom))

  useEffect(() => {
    getCurrentWindow()
      .setTitle(title)
      .catch(error =>
        appLogger.warn('startup', 'desktop.window_title_failed', { error: String(error) })
      )
  }, [title])
}
