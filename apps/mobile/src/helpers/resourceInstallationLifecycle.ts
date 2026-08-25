import type { DownloadResourceArtifactResult } from './downloadResourceArtifact'
import type { ResourceInstallationRecoveryTarget } from './resourceInstallationJournal'

export interface ResourceInstallationLifecycle {
  prepare: (
    result: DownloadResourceArtifactResult,
    recoveryTarget?: ResourceInstallationRecoveryTarget
  ) => void | Promise<void>
  commit: (result: DownloadResourceArtifactResult) => void | Promise<void>
}
