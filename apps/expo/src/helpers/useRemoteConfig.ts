import { useEffect } from 'react'
import {
  activate,
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  onConfigUpdate,
} from '@react-native-firebase/remote-config'

import {
  ASSISTANT_OPEN_KEY,
  BETA_UIDS_KEY,
  publishAssistantOpening,
  REMOTE_CONFIG_FETCH_INTERVAL_MS,
  remoteConfigDefaults,
} from './assistantOpening'
import {
  publishStoreReviewing,
  STORE_REVIEWING_DEFAULT,
  STORE_REVIEWING_KEY,
} from './storeReviewing'

export const useRemoteConfig = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return
    const rc = getRemoteConfig()
    const publish = () => {
      publishAssistantOpening({
        open: getValue(rc, ASSISTANT_OPEN_KEY).asBoolean(),
        betaUids: getValue(rc, BETA_UIDS_KEY).asString(),
      })
      // A value with no source yet (defaults not applied) keeps donations hidden.
      const reviewing = getValue(rc, STORE_REVIEWING_KEY)
      publishStoreReviewing(
        reviewing.getSource() === 'static' ? STORE_REVIEWING_DEFAULT : reviewing.asBoolean()
      )
    }
    let stopListening: (() => void) | undefined
    ;(async () => {
      // Queued before fetchAndActivate, which waits for pending native mutations.
      rc.settings = { ...rc.settings, minimumFetchIntervalMillis: REMOTE_CONFIG_FETCH_INTERVAL_MS }
      rc.defaultConfig = {
        [STORE_REVIEWING_KEY]: STORE_REVIEWING_DEFAULT,
        ...remoteConfigDefaults,
      }
      // The values of the last start hold while the fetch runs.
      publish()
      try {
        const fetchedRemotely = await fetchAndActivate(rc)
        console.log(
          fetchedRemotely
            ? '[RemoteConfig] Configs were retrieved from the backend and activated.'
            : '[RemoteConfig] No configs were fetched from the backend, and the local configs were already activated'
        )
      } catch (error) {
        console.warn('[RemoteConfig] The backend did not answer', error)
      }
      publish()
    })()
    try {
      stopListening = onConfigUpdate(rc, {
        next: () => {
          void activate(rc)
            .then(publish)
            .catch(error => console.warn('[RemoteConfig] An update was not activated', error))
        },
        error: error => console.warn('[RemoteConfig] Updates stopped', error),
        complete: () => {},
      })
    } catch (error) {
      console.warn('[RemoteConfig] Updates are not followed', error)
    }
    return () => stopListening?.()
  }, [enabled])
}
