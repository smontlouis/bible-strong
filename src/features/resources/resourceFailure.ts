import type { BibleErrorType, BibleRecoveryAction } from '~helpers/bibleErrors'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import {
  ResourceAccessError,
  type ResourceAccessErrorCode,
  type ResourceRecoveryAction,
} from './resourceAccessError'

export type ResourceFailureCause =
  | 'not-found'
  | 'network-offline'
  | 'offline-copy-required'
  | 'invalid-offline-copy'
  | 'temporary-unavailable'
  | 'integrity-failure'
  | 'unsupported'
  | 'unknown'

export type ResourceFailureRecovery =
  | ResourceRecoveryAction
  | Extract<BibleRecoveryAction, 'reset-offline-store'>

export type ResourceFailure = {
  cause: ResourceFailureCause
  recoveries: ResourceFailureRecovery[]
}

export type ResourceFailureAction = 'retry' | 'download' | 'repair' | 'manage' | 'reset'

export type ResourceFailureIcon =
  | 'search'
  | 'wifi-off'
  | 'download-cloud'
  | 'alert-triangle'
  | 'cloud-off'
  | 'shield-off'
  | 'slash'
  | 'alert-circle'

export type ResourceFailurePresentation = {
  icon: ResourceFailureIcon
  detailKey:
    | 'Référence introuvable'
    | 'app.youAreOffline'
    | 'resource.status.offlineNotInstalled'
    | 'resource.status.onlineUnsupported'
    | 'bible.error.databaseCorrupted'
    | 'resource.action.temporarilyUnavailable'
    | 'bible.error.integrityFailure'
    | 'bible.error.unknown'
  actions: ResourceFailureAction[]
  connectionRequired: boolean
}

const accessErrorCauses: Record<ResourceAccessErrorCode, ResourceFailureCause> = {
  NOT_FOUND: 'not-found',
  NETWORK_OFFLINE: 'network-offline',
  OFFLINE_COPY_REQUIRED: 'offline-copy-required',
  INVALID_OFFLINE_COPY: 'invalid-offline-copy',
  TEMPORARY_UNAVAILABLE: 'temporary-unavailable',
  INTEGRITY_FAILURE: 'integrity-failure',
  RESOURCE_UNSUPPORTED: 'unsupported',
  UNKNOWN: 'unknown',
}

const bibleErrorCauses: Record<BibleErrorType, ResourceFailureCause> = {
  CHAPTER_NOT_FOUND: 'not-found',
  RESOURCE_OFFLINE: 'network-offline',
  BIBLE_NOT_FOUND: 'offline-copy-required',
  OFFLINE_COPY_INVALID: 'invalid-offline-copy',
  RESOURCE_TEMPORARY_UNAVAILABLE: 'temporary-unavailable',
  RESOURCE_INTEGRITY_ERROR: 'integrity-failure',
  RESOURCE_UNSUPPORTED: 'unsupported',
  UNKNOWN_ERROR: 'unknown',
}

export const resourceFailureFromAccessError = (error: unknown): ResourceFailure =>
  error instanceof ResourceAccessError
    ? resourceFailureFromAccessCode(error.code, error.recoveries)
    : { cause: 'unknown', recoveries: ['retry'] }

export const resourceFailureFromAccessCode = (
  code: ResourceAccessErrorCode | null,
  recoveries: ResourceRecoveryAction[] = []
): ResourceFailure =>
  code
    ? {
        cause: accessErrorCauses[code],
        recoveries:
          code === 'INVALID_OFFLINE_COPY' || code === 'INTEGRITY_FAILURE'
            ? [
                ...(code === 'INTEGRITY_FAILURE' || recoveries.includes('retry')
                  ? (['retry'] as const)
                  : []),
                'repair-offline-copy' as const,
                'manage-offline-copies' as const,
              ]
            : recoveries,
      }
    : { cause: 'unknown', recoveries: recoveries.length ? recoveries : ['retry'] }

export const resourceFailureFromAvailability = ({
  reason,
  recoveries,
}: {
  reason: 'offline-copy-required' | 'invalid-offline-copy' | 'temporary-unavailable'
  recoveries: ResourceRecoveryAction[]
}): ResourceFailure =>
  resourceFailureFromAccessCode(
    reason === 'invalid-offline-copy'
      ? 'INVALID_OFFLINE_COPY'
      : reason === 'temporary-unavailable'
        ? 'TEMPORARY_UNAVAILABLE'
        : 'OFFLINE_COPY_REQUIRED',
    reason === 'temporary-unavailable' && recoveries.length === 0 ? ['retry'] : recoveries
  )

export const resourceFailureFromStrongModuleAvailability = (
  availability: StrongLexiconModuleAvailability,
  recoveries: ResourceRecoveryAction[] = []
): ResourceFailure => {
  switch (availability.status) {
    case 'missing':
    case 'core-missing':
      return resourceFailureFromAccessCode(
        'OFFLINE_COPY_REQUIRED',
        recoveries.length ? recoveries : ['acquire-offline-copy']
      )
    case 'incompatible':
      return resourceFailureFromAccessCode('INVALID_OFFLINE_COPY', [
        ...(recoveries.length ? recoveries : (['acquire-offline-copy'] as const)),
        'manage-offline-copies',
      ])
    case 'corrupt':
      return resourceFailureFromAccessCode('INTEGRITY_FAILURE', [
        ...(recoveries.length ? recoveries : (['acquire-offline-copy'] as const)),
        'manage-offline-copies',
      ])
    case 'available':
      return { cause: 'unknown', recoveries: [] }
  }
}

export const resourceFailureFromBibleError = ({
  type,
  recoveries = [],
}: {
  type: BibleErrorType
  recoveries?: BibleRecoveryAction[]
}): ResourceFailure => {
  const cause = bibleErrorCauses[type]
  if (cause !== 'invalid-offline-copy' && cause !== 'integrity-failure') {
    return { cause, recoveries }
  }
  return {
    cause,
    recoveries: [
      ...(cause === 'integrity-failure' && !recoveries.includes('retry')
        ? (['retry'] as const)
        : []),
      ...(!recoveries.includes('repair-offline-copy') ? (['repair-offline-copy'] as const) : []),
      ...recoveries.filter(recovery => recovery !== 'acquire-offline-copy'),
    ],
  }
}

const includes = (failure: ResourceFailure, recovery: ResourceFailureRecovery) =>
  failure.recoveries.includes(recovery)

export const getResourceFailurePresentation = (
  failure: ResourceFailure,
  { isOnline }: { isOnline: boolean }
): ResourceFailurePresentation => {
  const connectionRequired =
    !isOnline &&
    (includes(failure, 'acquire-offline-copy') || includes(failure, 'repair-offline-copy'))
  const actions: ResourceFailureAction[] = []
  if (includes(failure, 'retry')) actions.push('retry')
  if (includes(failure, 'acquire-offline-copy') && isOnline) actions.push('download')
  if (includes(failure, 'repair-offline-copy')) actions.push('repair')
  if (includes(failure, 'manage-offline-copies')) actions.push('manage')
  if (includes(failure, 'reset-offline-store')) actions.push('reset')

  switch (failure.cause) {
    case 'not-found':
      return {
        icon: 'search',
        detailKey: 'Référence introuvable',
        actions: actions.filter(action => action !== 'download'),
        connectionRequired: false,
      }
    case 'network-offline':
      return {
        icon: 'wifi-off',
        detailKey: 'app.youAreOffline',
        actions,
        connectionRequired,
      }
    case 'offline-copy-required':
      return {
        icon: isOnline ? 'download-cloud' : 'wifi-off',
        detailKey: isOnline ? 'resource.status.offlineNotInstalled' : 'app.youAreOffline',
        actions,
        connectionRequired,
      }
    case 'invalid-offline-copy':
      return {
        icon: 'alert-triangle',
        detailKey: 'bible.error.databaseCorrupted',
        actions,
        connectionRequired,
      }
    case 'temporary-unavailable':
      return {
        icon: 'cloud-off',
        detailKey: 'resource.action.temporarilyUnavailable',
        actions,
        connectionRequired,
      }
    case 'integrity-failure':
      return {
        icon: 'shield-off',
        detailKey: 'bible.error.integrityFailure',
        actions,
        connectionRequired,
      }
    case 'unsupported':
      return {
        icon: 'slash',
        detailKey: 'resource.status.onlineUnsupported',
        actions,
        connectionRequired,
      }
    case 'unknown':
      return {
        icon: 'alert-circle',
        detailKey: 'bible.error.unknown',
        actions,
        connectionRequired,
      }
  }
}
