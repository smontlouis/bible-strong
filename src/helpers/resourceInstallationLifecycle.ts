import type { DownloadWithCdnFallbackResult } from './downloadWithCdnFallback'
import type { ResourceInstallationRecoveryTarget } from './resourceInstallationJournal'

export interface ResourceInstallationLifecycle {
  prepare: (
    result: DownloadWithCdnFallbackResult,
    recoveryTarget?: ResourceInstallationRecoveryTarget
  ) => void | Promise<void>
  commit: (result: DownloadWithCdnFallbackResult) => void | Promise<void>
}
