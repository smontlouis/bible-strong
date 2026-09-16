import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { appStoreUrl, playStoreUrl } from '../lib/app-links'
import { useI18n } from '../locales'

interface NativeInstallPrompt extends Event {
  platforms: string[]
  prompt: () => Promise<unknown>
}

function isNativeInstallPrompt(event: Event): event is NativeInstallPrompt {
  return (
    'platforms' in event &&
    Array.isArray(event.platforms) &&
    event.platforms.includes('play') &&
    'prompt' in event &&
    typeof event.prompt === 'function'
  )
}

export function MobileDownloadLink() {
  const t = useI18n()
  const [href, setHref] = useState('#telecharger')
  const installPrompt = useRef<NativeInstallPrompt | null>(null)

  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) {
      setHref(playStoreUrl)
    } else if (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ) {
      setHref(appStoreUrl)
    }

    const handleInstallPrompt = (event: Event) => {
      if (!isNativeInstallPrompt(event)) return
      event.preventDefault()
      installPrompt.current = event
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  const download = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const prompt = installPrompt.current
    if (!prompt) return
    event.preventDefault()
    installPrompt.current = null
    try {
      await prompt.prompt()
    } catch {
      window.location.assign(playStoreUrl)
    }
  }

  return (
    <a className="button button--compact button--mobile-app" href={href} onClick={download}>
      {t('home.cta.getApp')}
    </a>
  )
}
