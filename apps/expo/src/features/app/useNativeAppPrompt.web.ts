import { usePathname } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { appLogger } from '~helpers/agentObservability'
import { storage } from '~helpers/storage'
import {
  nativeAppStoreFor,
  nativeAppStoreUrl,
  shouldShowNativeAppPrompt,
  smartAppBannerContent,
} from './nativeAppPrompt'

const DISMISSED_AT_KEY = 'nativeAppPromptDismissedAt'

const currentDevice = () => ({
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone:
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
})

// Points phones and tablets to the native apps (ADR-0067). iOS Safari shows Apple's Smart App
// Banner, kept on the current route here; other mobile browsers get the in-app prompt.
export const useNativeAppPrompt = () => {
  const pathname = usePathname()
  const [visible, setVisible] = useState(() =>
    shouldShowNativeAppPrompt(currentDevice(), storage.getNumber(DISMISSED_AT_KEY), Date.now())
  )

  useEffect(() => {
    document
      .querySelector('meta[name="apple-itunes-app"]')
      ?.setAttribute('content', smartAppBannerContent(pathname, window.location.search))
  }, [pathname])

  const store = nativeAppStoreFor(currentDevice())

  const dismiss = () => {
    storage.set(DISMISSED_AT_KEY, Date.now())
    setVisible(false)
  }

  const openStore = () => {
    if (!store) return
    Linking.openURL(nativeAppStoreUrl(store)).catch(error =>
      appLogger.warn('navigation', 'nativeAppPrompt.openStore', { error })
    )
    dismiss()
  }

  return { visible: visible && store !== null, openStore, dismiss }
}
