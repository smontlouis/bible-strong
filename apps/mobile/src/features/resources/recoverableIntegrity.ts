import { appLogger } from '~helpers/agentObservability'

export const warnAboutRecoverableResourceIntegrity = (
  issue: string,
  details: Record<string, unknown>
) => {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return
  appLogger.warn('quality', 'resource.recoverable_integrity', { issue, ...details })
  // Metro visibility is intentional: publication defects must be immediately visible while testing.
  console.warn(`[ResourceAccess] Recoverable integrity warning: ${issue}`, details)
}
