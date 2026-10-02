import { Serwist } from '@serwist/window'
import { useEffect, useRef, useState } from 'react'
import { appLogger } from '~helpers/agentObservability'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// Registers the app-shell service worker (ADR-0067) and reports when a new deployment is
// waiting. Production web builds only.
export const useServiceWorkerUpdate = () => {
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

  return { updateWaiting, applyUpdate, dismissUpdate: () => setUpdateWaiting(false) }
}
