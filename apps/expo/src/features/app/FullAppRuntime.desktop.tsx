import { useEffect, type ReactNode } from 'react'

import DesktopShell from '~desktop/DesktopShell'
import { offlineResourceRegistry } from '~features/resources/resourceAvailability'
import LocalMigrationGate from '~features/migrations/LocalMigrationGate'
import { appLogger } from '~helpers/agentObservability'
import { downloadManager } from '~helpers/downloadManager'
import { loadMobileResourceCatalog } from '~helpers/mobileResourceCatalog'
import type { Theme } from '~themes/index'

import WebFullAppRuntime from './FullAppRuntime.web'

/**
 * The desktop app (ADR-0107): the web workspace, plus the native startup of Offline copies.
 * The migration gate recovers an interrupted installation from its journal; then the catalog
 * loads, the download queue resumes and every installed copy is checked once.
 */
const OfflineCopiesStartup = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void loadMobileResourceCatalog().then(async catalog => {
      try {
        await downloadManager.restore()
      } catch (error) {
        appLogger.captureError('startup', 'resource_recovery.failed', error)
      }
      await offlineResourceRegistry.reconcileAll(catalog)
    })
  }, [])

  return children
}

const FullAppRuntime = ({ theme }: { theme: Theme }) => (
  <LocalMigrationGate>
    <OfflineCopiesStartup>
      <WebFullAppRuntime theme={theme}>
        <DesktopShell />
      </WebFullAppRuntime>
    </OfflineCopiesStartup>
  </LocalMigrationGate>
)

export default FullAppRuntime
