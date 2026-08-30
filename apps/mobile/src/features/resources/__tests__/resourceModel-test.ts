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
    [{ kind: 'dictionary', work: 'westphal', language: 'fr' }, 'dictionary:westphal:fr'],
    [
      { kind: 'dictionary', work: 'easton-webster', language: 'en' },
      'dictionary:easton-webster:en',
    ],
    [{ kind: 'nave', language: 'fr' }, 'nave:fr'],
    [{ kind: 'nave', language: 'en' }, 'nave:en'],
    [{ kind: 'cross-references' }, 'cross-references'],
    [{ kind: 'commentary', collection: 'MHY', language: 'fr' }, 'commentary:MHY:fr'],
    [{ kind: 'commentary', collection: 'FIRESTORE', language: 'en' }, 'commentary:FIRESTORE:en'],
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
      connectivity: 'online',
    }

    expect(getResourceActions(state)).toEqual(['open', 'make-available-offline'])
  })

  it('declares only explicitly served publications remotely readable', () => {
    expect(
      getResourceOnlineAccess({ kind: 'bible-text', versionId: 'LSG' }, new Set(['LSG']))
    ).toEqual({ status: 'remotely-readable' })
    expect(
      getResourceOnlineAccess(
        { kind: 'dictionary', work: 'westphal', language: 'fr' },
        new Set(['LSG'])
      )
    ).toEqual({ status: 'unsupported' })
    expect(
      getResourceOnlineAccess({ kind: 'nave', language: 'fr' }, new Set(['LSG']), new Set(['fr']))
    ).toEqual({ status: 'remotely-readable' })
    expect(
      getResourceOnlineAccess(
        { kind: 'strong-bible-index', versionId: 'LSG' },
        new Set(['LSG']),
        new Set(['fr']),
        new Set(['LSG'])
      )
    ).toEqual({ status: 'remotely-readable' })
    expect(
      getResourceOnlineAccess({ kind: 'nave', language: 'en' }, new Set(['LSG']), new Set(['fr']))
    ).toEqual({ status: 'unsupported' })
    expect(
      getResourceOnlineAccess(
        { kind: 'strong-lexicon', moduleId: 'resources' },
        new Set(['LSG']),
        new Set(['fr']),
        new Set(['LSG']),
        new Set(['fr', 'en']),
        new Set(['core', 'resources', 'entities'])
      )
    ).toEqual({ status: 'remotely-readable' })
  })

  it('represents Firestore commentaries as remote-only without changing MHY delivery', () => {
    expect(
      getResourceOnlineAccess(
        { kind: 'commentary', collection: 'FIRESTORE', language: 'en' },
        new Set()
      )
    ).toEqual({ status: 'remotely-readable' })
    expect(
      getResourceOnlineAccess({ kind: 'commentary', collection: 'MHY', language: 'fr' }, new Set())
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
      { kind: 'dictionary', work: 'westphal', language: 'fr' },
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
      connectivity: 'offline',
    }

    expect(getResourceActions(state)).toEqual(['open', 'remove-offline-copy', 'manage-storage'])
  })

  it.each<[ResourceState, string[]]>([
    [
      {
        identity: { kind: 'dictionary', work: 'westphal', language: 'fr' },
        operations: ['read', 'browse', 'search'],
        onlineAccess: { status: 'remotely-readable' },
        offlineCopy: { status: 'update-available', revision: 'dictionary-fr-1' },
        content: { status: 'available', source: 'offline' },
        connectivity: 'online',
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
        connectivity: 'online',
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
        connectivity: 'online',
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
        connectivity: 'online',
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
        connectivity: 'online',
      },
      [],
    ],
  ])('derives storage-agnostic actions from capability state', (state, expectedActions) => {
    expect(getResourceActions(state)).toEqual(expectedActions)
  })

  it('asks for a connection instead of offering an impossible Offline-copy download', () => {
    const state: ResourceState = {
      identity: { kind: 'strong-lexicon', moduleId: 'core' },
      operations: ['read', 'browse', 'search'],
      onlineAccess: { status: 'unsupported' },
      offlineCopy: { status: 'not-installed', supported: true },
      content: { status: 'offline-unavailable' },
      connectivity: 'offline',
    }

    expect(getResourceActions(state)).toEqual(['connection-required'])
  })

  it('does not offer an Offline-copy update until connectivity returns', () => {
    const state: ResourceState = {
      identity: { kind: 'bible-text', versionId: 'LSG' },
      operations: ['read'],
      onlineAccess: { status: 'remotely-readable' },
      offlineCopy: { status: 'update-available', revision: 'old' },
      content: { status: 'available', source: 'offline' },
      connectivity: 'offline',
    }

    expect(getResourceActions(state)).toEqual([
      'open',
      'connection-required',
      'remove-offline-copy',
      'manage-storage',
    ])
  })
})
