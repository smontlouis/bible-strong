import { useEffect } from 'react'

import {
  ASSISTANT_OPEN_KEY,
  BETA_UIDS_KEY,
  publishAssistantOpening,
  REMOTE_CONFIG_FETCH_INTERVAL_MS,
  remoteConfigDefaults,
} from './assistantOpening'
import { firebaseApp } from './firebaseApp.web'

/**
 * Remote Config in the browser and the desktop app, for who sees the assistant and Premium
 * (`assistantOpening`). The SDK loads after the first render: nothing waits for it.
 */
export const useRemoteConfig = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return
    let active = true
    let stopListening: (() => void) | undefined
    ;(async () => {
      try {
        const sdk = await import('firebase/remote-config')
        if (!active || !(await sdk.isSupported())) return
        const rc = sdk.getRemoteConfig(firebaseApp)
        rc.settings.minimumFetchIntervalMillis = REMOTE_CONFIG_FETCH_INTERVAL_MS
        rc.defaultConfig = remoteConfigDefaults
        const publish = () => {
          if (!active) return
          publishAssistantOpening({
            open: sdk.getValue(rc, ASSISTANT_OPEN_KEY).asBoolean(),
            betaUids: sdk.getValue(rc, BETA_UIDS_KEY).asString(),
          })
        }
        // The values of the last visit hold while the fetch runs.
        await sdk.ensureInitialized(rc)
        publish()
        await sdk.fetchAndActivate(rc)
        publish()
        if (!active) return
        stopListening = sdk.onConfigUpdate(rc, {
          next: () => {
            void sdk
              .activate(rc)
              .then(publish)
              .catch(error => console.warn('[RemoteConfig] An update was not activated', error))
          },
          error: error => console.warn('[RemoteConfig] Updates stopped', error),
          complete: () => {},
        })
      } catch (error) {
        console.warn('[RemoteConfig] The backend did not answer', error)
      }
    })()
    return () => {
      active = false
      stopListening?.()
    }
  }, [enabled])
}
