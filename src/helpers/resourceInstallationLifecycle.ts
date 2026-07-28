import type { DownloadWithCdnFallbackResult } from './downloadWithCdnFallback'

export interface ResourceInstallationLifecycle {
  prepare: (result: DownloadWithCdnFallbackResult) => void | Promise<void>
  commit: (result: DownloadWithCdnFallbackResult) => void | Promise<void>
}
