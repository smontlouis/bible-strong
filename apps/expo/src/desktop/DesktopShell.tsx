import * as Sentry from '@sentry/react-native'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom, useStore } from 'jotai/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useOpenTargetInTab } from '~features/app-switcher/utils/useOpenTargetInTab'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useSlideNewTab } from '~features/app-switcher/utils/useSlideNewTab'
import { replayWorkspaceOnboardingAtom } from '~features/onboarding/workspace/state'
import { markForPrint } from '~features/print/markForPrint'
import { appLogger } from '~helpers/agentObservability'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import { flushStorage } from '~helpers/storage.desktop'
import { resolveSystemPath } from '~navigation/systemLinks'
import { isQueueProcessingAtom } from '~state/downloadQueue'
import { useSwitchGroup } from '~state/tabGroups'
import { activeGroupAtom, type TabItem } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'

import { desktopBootstrap, invoke } from './bridge'
import { isMenuShortcut, runMenuShortcut } from './desktopMenuShortcuts'
import { parseRecentPassageId } from './desktopMenuState'
import { lookUpPassage } from './lookUp'
import { takeReadingReminderUrl } from './readingReminders'
import { checkDesktopUpdate } from './desktopUpdates'
import { useDesktopDownloadProgress } from './downloadProgress'
import { type TextSizeChange, useTextSizeChange } from './textSize'
import { desktopRecentsClearedAtAtom, useDesktopMenu } from './useDesktopMenu'
import { useDesktopAppearance } from './useDesktopAppearance'
import { useDesktopWindowTitle } from './useDesktopWindowTitle'
import { useDesktopFullscreen } from './windowControls'

const APP_SCHEME = 'biblestrong://'

/** What the shell kept for the page (`inbox.rs`). */
type Delivery = { kind: 'lookUp'; text: string } | { kind: 'open'; url: string }
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
 * onboarding's story again, its Window menu lists the tabs and File › Open Recent the last
 * passages read), the window's appearance and title,
 * the Offline copies' progress on the Dock icon, links handed over by the system, updates, and the
 * last key-value writes before the app quits.
 * Renders nothing.
 */
const DesktopShell = () => {
  const router = useRouter()
  const store = useStore()
  const { i18n } = useTranslation()
  const version = useDefaultBibleVersion()
  const openInNewTab = useOpenInNewTab()
  const downloading = useAtomValue(isQueueProcessingAtom)
  useDesktopAppearance()
  useDesktopWindowTitle()
  useDesktopFullscreen()
  useDesktopDownloadProgress()
  const changeTextSize = useTextSizeChange()
  const replayOnboarding = useSetAtom(replayWorkspaceOnboardingAtom)
  const clearRecents = useSetAtom(desktopRecentsClearedAtAtom)
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const openInTab = useOpenTargetInTab()
  const { refresh: refreshMenu } = useDesktopMenu()

  // The menu's listener is set once: it reads the latest of these through the ref.
  const actions = useRef({
    openInTab,
    openInNewTab,
    refreshMenu,
    switchGroup,
    triggerSlideNewTab,
    version,
    language: i18n.language,
  })
  actions.current = {
    openInTab,
    openInNewTab,
    refreshMenu,
    switchGroup,
    triggerSlideNewTab,
    version,
    language: i18n.language,
  }

  const selectTab = (tabId: string) => {
    const group = store.get(activeGroupAtom)
    if (group.tabs.some(tab => tab.id === tabId)) {
      actions.current.switchGroup(group.id)
      router.dismissTo('/')
      actions.current.triggerSlideNewTab(tabId)
    }
    // The chosen item flipped its own check mark: the menu shows the active tab again.
    actions.current.refreshMenu()
  }

  // Text selected in another app and sent by the macOS Service: a reference opens in a tab, in
  // the reader's version, anything else in a search of its own.
  const lookUp = (text: string) => {
    const { language, version: readerVersion } = actions.current
    const passage = lookUpPassage(text, readerVersion, language === 'en' ? 'en' : 'fr')
    if (passage) {
      actions.current.openInTab(passage)
      return
    }
    actions.current.openInNewTab(
      {
        id: `search-${generateUUID()}`,
        type: 'search',
        isRemovable: true,
        title: text,
        data: { searchValue: text },
      } as TabItem,
      { autoRedirect: true }
    )
  }

  // A link handed over by the system: a clicked reading reminder opens its reading
  // (`ReadingReminders`), anything else its route.
  const openAddress = (url: string) => {
    if (takeReadingReminderUrl(url)) return
    const route = desktopLinkRoute(url)
    if (route) router.push(route as never)
  }

  const takeDeliveries = async () => {
    try {
      const deliveries = await invoke<Delivery[]>('inbox_take')
      for (const delivery of deliveries) {
        if (delivery.kind === 'lookUp') lookUp(delivery.text)
        else openAddress(delivery.url)
      }
    } catch (error) {
      appLogger.captureError('startup', 'desktop.inbox_failed', error)
    }
  }

  const openRecentPassage = (id: string) => {
    const passage = parseRecentPassageId(id)
    const book = passage && getBook(passage.book)
    if (!passage || !book) return
    actions.current.openInTab({
      kind: 'bible',
      route: { version: passage.version, presentation: 'text', book, chapter: passage.chapter },
    })
  }

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
        } else if (kind === 'tab') {
          selectTab(value)
        } else if (kind === 'recent') {
          openRecentPassage(value)
        } else if (kind === 'recents') {
          clearRecents(Date.now())
        } else if (kind === 'onboarding') {
          replayOnboarding()
        } else if (kind === 'print') {
          markForPrint(document)
          invoke('webview_print').catch(error =>
            appLogger.captureError('startup', 'desktop.print_failed', error)
          )
        }
      }),
      listen('desktop://inbox', () => void takeDeliveries()),
      listen<string[]>('desktop://open-url', ({ payload }) => {
        // The first address the workspace knows: a reading reminder or a route.
        const url = payload.find(
          address =>
            address.startsWith('biblestrong://reading-reminder?') || desktopLinkRoute(address)
        )
        if (url) openAddress(url)
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
    // What arrived before the page listened: the Service or a reminder that launched the app.
    void takeDeliveries()
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
