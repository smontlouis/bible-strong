import {
  createResourceIdentityId,
  getResourceActions,
  getResourceOnlineAccess,
  resourceIdentityFromOfflineCopy,
  type ResourceIdentity,
  type ResourceState,
} from '../resourceModel'

describe('Resource model', () => {
  const identities: [ResourceIdentity, string][] = [
    [{ kind: 'bible-text', versionId: 'LSG' }, 'bible-text:LSG'],
    [
      { kind: 'bible-presentation', versionId: 'LSG', presentation: 'pericope' },
      'bible-presentation:LSG:pericope',
    ],
    [
      { kind: 'bible-presentation', versionId: 'LSG', presentation: 'red-words' },
      'bible-presentation:LSG:red-words',
    ],
    [{ kind: 'strong-bible-index', versionId: 'LSG' }, 'strong-bible-index:LSG'],
    [{ kind: 'interlinear-index', versionId: 'BHG', language: 'fr' }, 'interlinear-index:BHG:fr'],
    [{ kind: 'interlinear-index', versionId: 'BHG', language: 'en' }, 'interlinear-index:BHG:en'],
    [{ kind: 'strong-lexicon', moduleId: 'core' }, 'strong-lexicon:core'],
    [{ kind: 'strong-lexicon', moduleId: 'resources' }, 'strong-lexicon:resources'],
    [{ kind: 'strong-lexicon', moduleId: 'entities' }, 'strong-lexicon:entities'],
    [{ kind: 'dictionary', language: 'fr' }, 'dictionary:fr'],
    [{ kind: 'dictionary', language: 'en' }, 'dictionary:en'],
    [{ kind: 'nave', language: 'fr' }, 'nave:fr'],
    [{ kind: 'nave', language: 'en' }, 'nave:en'],
    [{ kind: 'cross-references' }, 'cross-references'],
    [{ kind: 'commentary', collection: 'MHY', language: 'fr' }, 'commentary:MHY:fr'],
    [{ kind: 'timeline', language: 'fr' }, 'timeline:fr'],
    [{ kind: 'timeline', language: 'en' }, 'timeline:en'],
  ]

  it.each(identities)('gives $kind a stable domain identity', (identity, expectedId) => {
    expect(createResourceIdentityId(identity)).toBe(expectedId)
  })

  it('keeps Online access independent from an absent Offline copy', () => {
    const state: ResourceState = {
      identity: { kind: 'bible-text', versionId: 'LSG' },
      operations: ['read', 'search'],
      onlineAccess: { status: 'remotely-readable' },
      offlineCopy: { status: 'not-installed', supported: true },
      content: { status: 'idle' },
    }

    expect(getResourceActions(state)).toEqual(['open', 'make-available-offline'])
  })

  it('declares only explicitly served Bible publications remotely readable', () => {
    expect(
      getResourceOnlineAccess({ kind: 'bible-text', versionId: 'LSG' }, new Set(['LSG']))
    ).toEqual({ status: 'remotely-readable' })
    expect(
      getResourceOnlineAccess({ kind: 'dictionary', language: 'fr' }, new Set(['LSG']))
    ).toEqual({ status: 'unsupported' })
  })

  it.each([
    [
      { kind: 'bible', versionId: 'LSG' },
      { kind: 'bible-text', versionId: 'LSG' },
    ],
    [
      { kind: 'bible-pericope', versionId: 'LSG' },
      { kind: 'bible-presentation', versionId: 'LSG', presentation: 'pericope' },
    ],
    [
      { kind: 'bible-red-words', versionId: 'LSG' },
      { kind: 'bible-presentation', versionId: 'LSG', presentation: 'red-words' },
    ],
    [
      { kind: 'strong-bible-index', versionId: 'LSG' },
      { kind: 'strong-bible-index', versionId: 'LSG' },
    ],
    [
      { kind: 'interlinear-index', versionId: 'BHG', language: 'en' },
      { kind: 'interlinear-index', versionId: 'BHG', language: 'en' },
    ],
    [
      { kind: 'strong-lexicon-module', moduleId: 'resources' },
      { kind: 'strong-lexicon', moduleId: 'resources' },
    ],
    [
      { kind: 'database', databaseId: 'DICTIONNAIRE', language: 'fr' },
      { kind: 'dictionary', language: 'fr' },
    ],
    [
      { kind: 'database', databaseId: 'NAVE', language: 'en' },
      { kind: 'nave', language: 'en' },
    ],
    [{ kind: 'database', databaseId: 'TRESOR', language: 'fr' }, { kind: 'cross-references' }],
    [
      { kind: 'database', databaseId: 'MHY', language: 'fr' },
      { kind: 'commentary', collection: 'MHY', language: 'fr' },
    ],
    [
      { kind: 'database', databaseId: 'TIMELINE', language: 'en' },
      { kind: 'timeline', language: 'en' },
    ],
  ] as const)(
    'maps every current Offline-copy family into the Resource domain',
    (copy, resource) => {
      expect(resourceIdentityFromOfflineCopy(copy)).toEqual(resource)
    }
  )

  it('keeps an installed Offline copy usable when Online access is unavailable', () => {
    const state: ResourceState = {
      identity: { kind: 'nave', language: 'en' },
      operations: ['read', 'browse', 'search'],
      onlineAccess: { status: 'temporarily-unavailable' },
      offlineCopy: { status: 'installed', revision: 'nave-en-1' },
      content: { status: 'available', source: 'offline' },
    }

    expect(getResourceActions(state)).toEqual(['open', 'remove-offline-copy', 'manage-storage'])
  })

  it.each<[ResourceState, string[]]>([
    [
      {
        identity: { kind: 'dictionary', language: 'fr' },
        operations: ['read', 'browse', 'search'],
        onlineAccess: { status: 'remotely-readable' },
        offlineCopy: { status: 'update-available', revision: 'dictionary-fr-1' },
        content: { status: 'available', source: 'offline' },
      },
      ['open', 'update', 'remove-offline-copy', 'manage-storage'],
    ],
    [
      {
        identity: { kind: 'timeline', language: 'fr' },
        operations: ['read', 'browse', 'search'],
        onlineAccess: { status: 'unsupported' },
        offlineCopy: { status: 'downloading', progress: 0.4 },
        content: { status: 'loading' },
      },
      ['manage-storage'],
    ],
    [
      {
        identity: { kind: 'strong-lexicon', moduleId: 'entities' },
        operations: ['read', 'browse', 'search'],
        onlineAccess: { status: 'unsupported' },
        offlineCopy: { status: 'invalid', recoverable: true },
        content: { status: 'offline-unavailable' },
      },
      ['retry', 'make-available-offline', 'manage-storage'],
    ],
    [
      {
        identity: { kind: 'commentary', collection: 'MHY', language: 'fr' },
        operations: ['read'],
        onlineAccess: { status: 'temporarily-unavailable' },
        offlineCopy: { status: 'not-installed', supported: true },
        content: { status: 'temporarily-unavailable', retryable: true },
      },
      ['retry', 'make-available-offline'],
    ],
    [
      {
        identity: { kind: 'bible-text', versionId: 'UNKNOWN' },
        operations: ['read', 'search'],
        onlineAccess: { status: 'unsupported' },
        offlineCopy: { status: 'unsupported' },
        content: { status: 'not-found' },
      },
      [],
    ],
  ])('derives storage-agnostic actions from capability state', (state, expectedActions) => {
    expect(getResourceActions(state)).toEqual(expectedActions)
  })
})
