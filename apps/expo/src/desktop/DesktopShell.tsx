import * as Sentry from '@sentry/react-native'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { replayWorkspaceOnboardingAtom } from '~features/onboarding/workspace/state'
import { markForPrint } from '~features/print/markForPrint'
import { appLogger } from '~helpers/agentObservability'
import { flushStorage } from '~helpers/storage.desktop'
import { resolveSystemPath } from '~navigation/systemLinks'
import { isQueueProcessingAtom } from '~state/downloadQueue'

import { desktopBootstrap, invoke } from './bridge'
import { isMenuShortcut, runMenuShortcut } from './desktopMenuShortcuts'
import { checkDesktopUpdate } from './desktopUpdates'
import { useDesktopDownloadProgress } from './downloadProgress'
import { type TextSizeChange, useTextSizeChange } from './textSize'
import { useDesktopAppearance } from './useDesktopAppearance'
import { useDesktopWindowTitle } from './useDesktopWindowTitle'
import { useDesktopFullscreen } from './windowControls'

const APP_SCHEME = 'biblestrong://'
const UPDATE_CHECK_DELAY_MS = 15_000

/** `biblestrong://bible/LSG/…` or a page of the site, to a route of the workspace. */
export const desktopLinkRoute = (url: string): string | undefined => {
  if (url.startsWith(APP_SCHEME)) {
    const path = `/${url.slice(APP_SCHEME.length).replace(/^\/+/u, '')}`
    return resolveSystemPath(path)
  }
  const route = resolveSystemPath(url)
  return route.startsWith('/') ? route : undefined
}

/**
 * What only the desktop app does at runtime: the native menu (its Help menu plays the
 * onboarding's story again), the window's appearance and title,
 * the Offline copies' progress on the Dock icon, links handed over by the system, updates, and the
 * last key-value writes before the app quits.
 * Renders nothing.
 */
const DesktopShell = () => {
  const router = useRouter()
  const { i18n } = useTranslation()
  const downloading = useAtomValue(isQueueProcessingAtom)
  useDesktopAppearance()
  useDesktopWindowTitle()
  useDesktopFullscreen()
  useDesktopDownloadProgress()
  const changeTextSize = useTextSizeChange()
  const replayOnboarding = useSetAtom(replayWorkspaceOnboardingAtom)

  // A hidden page must not freeze halfway through an installation. The shell turns WebKit's
  // throttling off on macOS 14+; Chromium (Windows) does not freeze a page holding a Web Lock.
  useEffect(() => {
    if (!downloading || typeof navigator === 'undefined' || !navigator.locks) return
    let release = () => {}
    void navigator.locks.request(
      'bible-strong-offline-copies',
      () =>
        new Promise<void>(resolve => {
          release = resolve
        })
    )
    return () => release()
  }, [downloading])

  useEffect(() => {
    void invoke('menu_set_language', { language: i18n.language === 'en' ? 'en' : 'fr' })
  }, [i18n.language])

  useEffect(() => {
    const { platform, appVersion } = desktopBootstrap()
    // Desktop errors stay apart from the browser's in Sentry.
    Sentry.getCurrentScope().setTags({ desktop: platform, desktopVersion: appVersion })
    const subscriptions = [
      listen<string>('desktop://menu', ({ payload }) => {
        const [kind, ...rest] = payload.split(':')
        const value = rest.join(':')
        if (kind === 'shortcut' && isMenuShortcut(value)) {
          runMenuShortcut(value)
        } else if (kind === 'navigate') {
          router.push(value as never)
        } else if (kind === 'open') {
          void openUrl(value)
        } else if (kind === 'updates') {
          void checkDesktopUpdate({ announce: true })
        } else if (kind === 'text') {
          changeTextSize(value as TextSizeChange)
        } else if (kind === 'onboarding') {
          replayOnboarding()
        } else if (kind === 'print') {
          markForPrint(document)
          invoke('webview_print').catch(error =>
            appLogger.captureError('startup', 'desktop.print_failed', error)
          )
        }
      }),
      listen<string[]>('desktop://open-url', ({ payload }) => {
        const route = payload.map(desktopLinkRoute).find(Boolean)
        if (route) router.push(route as never)
      }),
      listen('desktop://flush', async () => {
        try {
          await flushStorage()
        } catch (error) {
          appLogger.captureError('startup', 'desktop.flush_failed', error)
        }
        await invoke('app_exit')
      }),
    ]
    const updateCheck = setTimeout(
      () => void checkDesktopUpdate({ announce: false }),
      UPDATE_CHECK_DELAY_MS
    )
    return () => {
      clearTimeout(updateCheck)
      subscriptions.forEach(subscription => void subscription.then(unlisten => unlisten()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default DesktopShell
