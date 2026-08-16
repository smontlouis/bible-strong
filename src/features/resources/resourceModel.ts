import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'

export type BiblePresentationResource = 'pericope' | 'red-words'
export type ResourceOperation = 'read' | 'browse' | 'search'

export type ResourceIdentity =
  | { kind: 'bible-text'; versionId: string }
  | {
      kind: 'bible-presentation'
      versionId: string
      presentation: BiblePresentationResource
    }
  | { kind: 'strong-bible-index'; versionId: string }
  | { kind: 'interlinear-index'; versionId: 'BHG'; language: ResourceLanguage }
  | { kind: 'strong-lexicon'; moduleId: StrongLexiconModuleId }
  | { kind: 'dictionary'; language: ResourceLanguage }
  | { kind: 'nave'; language: ResourceLanguage }
  | { kind: 'cross-references' }
  | { kind: 'commentary'; collection: 'MHY'; language: 'fr' }
  | { kind: 'timeline'; language: ResourceLanguage }

export type OnlineAccessState =
  | { status: 'remotely-readable' }
  | { status: 'temporarily-unavailable' }
  | { status: 'unsupported' }

export type OfflineCopyState =
  | { status: 'not-installed'; supported: true }
  | { status: 'installed'; revision: string }
  | { status: 'update-available'; revision: string }
  | { status: 'downloading'; progress: number }
  | { status: 'invalid'; recoverable: boolean }
  | { status: 'unsupported' }

export type ResourceContentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; source: 'online' | 'offline' }
  | { status: 'not-found' }
  | { status: 'temporarily-unavailable'; retryable: boolean }
  | { status: 'offline-unavailable' }

export type ResourceState = {
  identity: ResourceIdentity
  operations: readonly ResourceOperation[]
  onlineAccess: OnlineAccessState
  offlineCopy: OfflineCopyState
  content: ResourceContentState
}

export type ResourceAction =
  | 'open'
  | 'retry'
  | 'make-available-offline'
  | 'update'
  | 'remove-offline-copy'
  | 'manage-storage'

export const getResourceOnlineAccess = (
  identity: ResourceIdentity,
  remotelyReadableBibleVersions: ReadonlySet<string>
): OnlineAccessState =>
  identity.kind === 'bible-text' && remotelyReadableBibleVersions.has(identity.versionId)
    ? { status: 'remotely-readable' }
    : { status: 'unsupported' }

export const createResourceIdentityId = (identity: ResourceIdentity): string => {
  switch (identity.kind) {
    case 'bible-text':
      return `bible-text:${identity.versionId}`
    case 'bible-presentation':
      return `bible-presentation:${identity.versionId}:${identity.presentation}`
    case 'strong-bible-index':
      return `strong-bible-index:${identity.versionId}`
    case 'interlinear-index':
      return `interlinear-index:${identity.versionId}:${identity.language}`
    case 'strong-lexicon':
      return `strong-lexicon:${identity.moduleId}`
    case 'dictionary':
      return `dictionary:${identity.language}`
    case 'nave':
      return `nave:${identity.language}`
    case 'cross-references':
      return 'cross-references'
    case 'commentary':
      return `commentary:${identity.collection}:${identity.language}`
    case 'timeline':
      return `timeline:${identity.language}`
  }
}

export const resourceIdentityFromOfflineCopy = (
  identity: OfflineCopyIdentity
): ResourceIdentity | undefined => {
  switch (identity.kind) {
    case 'bible':
      return { kind: 'bible-text', versionId: identity.versionId }
    case 'bible-pericope':
      return {
        kind: 'bible-presentation',
        versionId: identity.versionId,
        presentation: 'pericope',
      }
    case 'bible-red-words':
      return {
        kind: 'bible-presentation',
        versionId: identity.versionId,
        presentation: 'red-words',
      }
    case 'strong-bible-index':
      return identity
    case 'interlinear-index':
      return identity
    case 'strong-lexicon-module':
      return { kind: 'strong-lexicon', moduleId: identity.moduleId }
    case 'database':
      switch (identity.databaseId) {
        case 'DICTIONNAIRE':
          return { kind: 'dictionary', language: identity.language }
        case 'NAVE':
          return { kind: 'nave', language: identity.language }
        case 'TRESOR':
          return { kind: 'cross-references' }
        case 'MHY':
          return identity.language === 'fr'
            ? { kind: 'commentary', collection: 'MHY', language: 'fr' }
            : undefined
        case 'TIMELINE':
          return { kind: 'timeline', language: identity.language }
      }
  }
}

export const getResourceActions = (state: ResourceState): ResourceAction[] => {
  const actions: ResourceAction[] = []
  const { content, offlineCopy, onlineAccess } = state

  if (
    content.status === 'available' ||
    (content.status === 'idle' &&
      (onlineAccess.status === 'remotely-readable' ||
        offlineCopy.status === 'installed' ||
        offlineCopy.status === 'update-available'))
  ) {
    actions.push('open')
  }

  if (
    (content.status === 'temporarily-unavailable' && content.retryable) ||
    (offlineCopy.status === 'invalid' && offlineCopy.recoverable)
  ) {
    actions.push('retry')
  }

  if (
    offlineCopy.status === 'not-installed' ||
    (offlineCopy.status === 'invalid' && offlineCopy.recoverable)
  ) {
    actions.push('make-available-offline')
  }

  if (offlineCopy.status === 'update-available') {
    actions.push('update')
  }

  if (offlineCopy.status === 'installed' || offlineCopy.status === 'update-available') {
    actions.push('remove-offline-copy')
  }

  if (
    offlineCopy.status === 'installed' ||
    offlineCopy.status === 'update-available' ||
    offlineCopy.status === 'downloading' ||
    offlineCopy.status === 'invalid'
  ) {
    actions.push('manage-storage')
  }

  return actions
}
