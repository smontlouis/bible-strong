import { useEffect } from 'react'
import {
  getRemoteConfig,
  setDefaults,
  fetchAndActivate,
} from '@react-native-firebase/remote-config'

export const useRemoteConfig = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return
    ;(async () => {
      const rc = getRemoteConfig()
      await setDefaults(rc, {
        apple_reviewing: false,
      })
      const fetchedRemotely = await fetchAndActivate(rc)

      if (fetchedRemotely) {
        console.log('[RemoteConfig] Configs were retrieved from the backend and activated.')
      } else {
        console.log(
          '[RemoteConfig] No configs were fetched from the backend, and the local configs were already activated'
        )
      }
    })()
  }, [enabled])
}
