import { Serwist } from '@serwist/window'
import { useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { appLogger } from '~helpers/agentObservability'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// Registers the app-shell service worker (ADR-0067) and offers to reload when a new
// deployment is waiting. Production web builds only. The prompt is a dedicated banner:
// sonner-native toasts dismiss on press and swallow their action on web.
const ServiceWorkerUpdates = () => {
  const { t } = useTranslation()
  const serwistRef = useRef<Serwist | null>(null)
  const [updateWaiting, setUpdateWaiting] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // A worker left by a local production export must not control `expo start --web`.
      void navigator.serviceWorker
        .getRegistrations()
        .then(registrations => Promise.all(registrations.map(r => r.unregister())))
      return
    }

    // Installed apps keep their shell and local data: ask the browser not to evict them.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      navigator.storage
        ?.persist?.()
        .catch(error => appLogger.debug('startup', 'storage.persist', { error }))
    }

    const serwist = new Serwist('/sw.js', { scope: '/' })
    serwistRef.current = serwist
    const onWaiting = () => setUpdateWaiting(true)
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return
      serwist.update().catch(error => appLogger.debug('startup', 'serviceWorker.update', { error }))
    }

    serwist.addEventListener('waiting', onWaiting)
    serwist
      .register()
      .catch(error => appLogger.error('startup', 'serviceWorker.register', { error }))
    const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', checkForUpdate)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', checkForUpdate)
      serwist.removeEventListener('waiting', onWaiting)
      serwistRef.current = null
    }
  }, [])

  const applyUpdate = () => {
    const serwist = serwistRef.current
    if (!serwist) return
    let reloading = false
    serwist.addEventListener('controlling', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
    serwist.messageSkipWaiting()
  }

  if (!updateWaiting) return null

  return (
    <Box pointerEvents="box-none" className="absolute bottom-4 left-0 right-0 items-center px-4">
      <HStack
        role="status"
        className="w-full max-w-[420px] items-center gap-3 rounded-2xl border border-border bg-reverse py-2.5 pl-4 pr-2"
        style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' }}
      >
        <Text className="flex-1 text-[14px] text-default">{t('app.webUpdateAvailable')}</Text>
        <Button small onPress={applyUpdate}>
          {t('app.webUpdateReload')}
        </Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Fermer')}
          hitSlop={8}
          onPress={() => setUpdateWaiting(false)}
          className="p-1.5"
        >
          <FeatherIcon name="x" size={18} color="tertiary" />
        </Pressable>
      </HStack>
    </Box>
  )
}

export default ServiceWorkerUpdates
