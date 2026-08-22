import { createContext, useContext, type ReactNode } from 'react'
import Constants from 'expo-constants'
import { onlineManager } from '@tanstack/react-query'
import { Platform } from 'react-native'
import {
  createBibleContentAccess,
  localBibleChapterAdapter,
  type BibleContentAccess,
} from '~features/resources/bibleContentAccess'
import {
  createHttpBibleChapterAdapter,
  createHybridBibleChapterAdapter,
  getConfiguredResourceApiBaseUrl,
  getDevelopmentResourceApiBaseUrl,
  isUsableBibleCoverage,
  unavailableHttpBibleChapterAdapter,
} from '~features/resources/bibleChapterSource'
import {
  createHttpBibleReadingResourceAccess,
  createHybridBibleReadingResourceAccess,
  localBibleReadingResourceAccess,
  type BibleReadingResourceAccess,
} from '~features/resources/bibleReadingResourceAccess'
import {
  createHttpBibleSearchAccess,
  createHybridBibleSearchAccess,
  localBibleSearchAccess,
  type BibleSearchAccess,
} from '~features/resources/bibleSearchAccess'
import {
  createHttpDictionaryAccess,
  createHybridDictionaryAccess,
  localDictionaryAccess,
  unavailableHttpDictionaryAccess,
  type DictionaryAccess,
} from '~features/resources/dictionaryAccess'
import {
  createHttpNaveAccess,
  createHybridNaveAccess,
  localNaveAccess,
  unavailableHttpNaveAccess,
  type NaveAccess,
} from '~features/resources/naveAccess'
import {
  createHttpStrongLexiconAccess,
  createHybridStrongLexiconAccess,
  localStrongLexiconAccess,
  type StrongLexiconAccess,
} from '~features/resources/strongLexiconAccess'
import {
  createHttpStrongBibleResourceAdapter,
  createHybridStrongBibleResourceAdapter,
  createStrongBibleResourceAccess,
  localStrongBibleResourceAdapter,
  type StrongBibleResourceAccess,
} from '~features/resources/strongBibleResourceAccess'
import {
  createHybridInterlinearLexiconAdapter,
  createLexiconBibleResourceAccess,
  type LexiconBibleResourceAccess,
} from '~features/resources/lexiconBibleResourceAccess'
import {
  createHttpInterlinearBibleResourceAdapter,
  createHybridInterlinearBibleResourceAdapter,
  localInterlinearBibleResourceAdapter,
  type InterlinearBibleResourceAccess,
} from '~features/resources/interlinearBibleResourceAccess'
import {
  createHttpTimelineAccess,
  createHybridTimelineAccess,
  localTimelineAccess,
  type TimelineAccess,
} from '~features/resources/timelineAccess'
import {
  createCommentaryAccess,
  createHttpCommentaryAccess,
  firestoreCommentaryAccess,
  localMhyCommentaryAccess,
  type CommentaryAccess,
} from '~features/resources/commentaryAccess'
import {
  isLocalResourceAvailable,
  type LocalResourceRef,
} from '~features/resources/resourceAvailability'
import {
  getResourceOnlineAccess,
  type OnlineAccessState,
  type ResourceIdentity,
} from '~features/resources/resourceModel'
import {
  configureResourceArtifactBaseUrl,
  getMobileBibleVersionIds,
} from '~helpers/mobileResourceCatalog'
import { PUBLIC_ONLINE_BIBLE_VERSION_IDS } from '~helpers/ordinaryBibleVersions'
import { STRONG_BIBLE_FALLBACK_PRIORITY } from '~helpers/strongBiblePublications'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { withResourceSourceLogging } from '~features/resources/resourceSourceLogger'
import { resourceApiFetch } from '~helpers/resourceAppCheck'

export type ResourceAccessRegistry = {
  bibleContent: BibleContentAccess
  bibleReading: BibleReadingResourceAccess
  bibleSearch: BibleSearchAccess
  dictionary: DictionaryAccess
  lexiconBible: LexiconBibleResourceAccess
  nave: NaveAccess
  strongLexicon: StrongLexiconAccess
  strongBible: StrongBibleResourceAccess
  interlinearBible: InterlinearBibleResourceAccess
  timeline: TimelineAccess
  commentary: CommentaryAccess
  offlineCopies: {
    isAvailable: (identity: LocalResourceRef) => Promise<boolean>
  }
  capabilities: {
    getOnlineAccess: (identity: ResourceIdentity) => OnlineAccessState
  }
}

const resourceApiBaseUrl =
  getConfiguredResourceApiBaseUrl(
    Constants.expoConfig?.extra?.resourceApiUrl as string | undefined
  ) ??
  (__DEV__ ? getDevelopmentResourceApiBaseUrl(Platform.OS as 'ios' | 'android' | 'web') : undefined)

const configuredResourceArtifactBaseUrl = Constants.expoConfig?.extra?.resourceArtifactBaseUrl as
  | string
  | undefined
configureResourceArtifactBaseUrl(configuredResourceArtifactBaseUrl)

const offlineSource = <Adapter extends object>(resource: string, adapter: Adapter) =>
  withResourceSourceLogging(adapter, { resource, source: 'offline' })
const onlineSource = <Adapter extends object>(resource: string, adapter: Adapter) =>
  withResourceSourceLogging(adapter, { resource, source: 'online' })

const localBibleChapterSource = withResourceSourceLogging(localBibleChapterAdapter, {
  resource: 'Bible',
  source: 'offline',
  isResolvedResult: (operation, result) => {
    if (operation !== 'loadCoverage' || !result || typeof result !== 'object') return true
    return isUsableBibleCoverage(
      result as Awaited<ReturnType<typeof localBibleChapterAdapter.loadCoverage>>
    )
  },
})
const onlineBibleChapterAdapter = resourceApiBaseUrl
  ? onlineSource(
      'Bible',
      createHttpBibleChapterAdapter({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : unavailableHttpBibleChapterAdapter
const remotelyReadableBibleVersions = new Set(
  resourceApiBaseUrl ? (__DEV__ ? getMobileBibleVersionIds() : PUBLIC_ONLINE_BIBLE_VERSION_IDS) : []
)
const bibleChapterAdapter = createHybridBibleChapterAdapter({
  offline: localBibleChapterSource,
  online: onlineBibleChapterAdapter,
  remotelyReadableVersions: remotelyReadableBibleVersions,
  isOnline: async () => onlineManager.isOnline(),
})
const onlineNaveAccess = resourceApiBaseUrl
  ? onlineSource(
      'Nave',
      createHttpNaveAccess({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : unavailableHttpNaveAccess
const remotelyReadableDictionaryLanguages = new Set<ResourceLanguage>(
  resourceApiBaseUrl ? ['fr', 'en'] : []
)
const remotelyReadableNaveLanguages = new Set<ResourceLanguage>(
  resourceApiBaseUrl ? ['fr', 'en'] : []
)
const remotelyReadableCommentaryCollections = new Set<string>(resourceApiBaseUrl ? ['MHY'] : [])
const remotelyReadableTimelineLanguages = new Set<ResourceLanguage>(
  resourceApiBaseUrl ? ['fr', 'en'] : []
)
const onlineDictionaryAccess = resourceApiBaseUrl
  ? onlineSource(
      'Dictionary',
      createHttpDictionaryAccess({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : unavailableHttpDictionaryAccess
const remotelyReadableStrongBibleVersions = new Set(
  resourceApiBaseUrl ? STRONG_BIBLE_FALLBACK_PRIORITY : []
)
const onlineStrongBibleAdapter = resourceApiBaseUrl
  ? onlineSource(
      'Strong Bible index',
      createHttpStrongBibleResourceAdapter({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
        bibleChapterAdapter,
      })
    )
  : localStrongBibleResourceAdapter
const strongBibleAccess = createStrongBibleResourceAccess(
  createHybridStrongBibleResourceAdapter({
    offline: offlineSource('Strong Bible index', localStrongBibleResourceAdapter),
    online: onlineStrongBibleAdapter,
    remotelyReadableVersions: remotelyReadableStrongBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  })
)
const remotelyReadableInterlinearLocales = new Set<ResourceLanguage>(
  resourceApiBaseUrl ? ['fr', 'en'] : []
)
const onlineInterlinearBibleAdapter = resourceApiBaseUrl
  ? onlineSource(
      'Interlinear Bible',
      createHttpInterlinearBibleResourceAdapter({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
        bibleChapterAdapter,
      })
    )
  : localInterlinearBibleResourceAdapter
const interlinearBibleAccess = createHybridInterlinearBibleResourceAdapter({
  offline: offlineSource('Interlinear Bible', localInterlinearBibleResourceAdapter),
  online: onlineInterlinearBibleAdapter,
  remotelyReadableLocales: remotelyReadableInterlinearLocales,
  isOnline: async () => onlineManager.isOnline(),
})
const lexiconBibleAccess = createLexiconBibleResourceAccess({
  strongBible: strongBibleAccess,
  interlinear: createHybridInterlinearLexiconAdapter(interlinearBibleAccess, bibleChapterAdapter),
})
const strongLexiconAccess = createHybridStrongLexiconAccess({
  offline: offlineSource('Strong lexicon', localStrongLexiconAccess),
  online: resourceApiBaseUrl
    ? onlineSource(
        'Strong lexicon',
        createHttpStrongLexiconAccess({
          baseUrl: resourceApiBaseUrl,
          fetcher: resourceApiFetch,
          isOnline: async () => onlineManager.isOnline(),
        })
      )
    : localStrongLexiconAccess,
  remotelyReadable: Boolean(resourceApiBaseUrl),
  isOnline: async () => onlineManager.isOnline(),
})
const remotelyReadableStrongLexiconModules = new Set(
  resourceApiBaseUrl ? ['core', 'resources', 'entities'] : []
)
const onlineBibleSearchAccess = resourceApiBaseUrl
  ? onlineSource(
      'Bible search',
      createHttpBibleSearchAccess({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        versions: [...remotelyReadableBibleVersions],
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : localBibleSearchAccess
const onlineBibleReadingAccess = resourceApiBaseUrl
  ? onlineSource(
      'Bible reading resources',
      createHttpBibleReadingResourceAccess({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : {
      getPericopeAvailability: async () => ({ status: 'unsupported' as const }),
      loadPericope: async () => {
        throw new Error('BIBLE_PERICOPE_HTTP_UNCONFIGURED')
      },
      getMhyAvailability: async () => ({ status: 'unsupported' as const }),
      loadMhyComments: async () => {
        throw new Error('COMMENTARY_HTTP_UNCONFIGURED')
      },
      getTresorAvailability: async () => ({
        status: 'unavailable' as const,
        reason: 'offline-copy-required' as const,
        recoveries: ['acquire-offline-copy' as const],
      }),
      loadTresorReferences: async () => {
        throw new Error('CROSS_REFERENCES_HTTP_UNCONFIGURED')
      },
    }
const onlineTimelineAccess = resourceApiBaseUrl
  ? onlineSource(
      'Timeline',
      createHttpTimelineAccess({
        baseUrl: resourceApiBaseUrl,
        fetcher: resourceApiFetch,
        isOnline: async () => onlineManager.isOnline(),
      })
    )
  : localTimelineAccess
const commentaryAccess = createCommentaryAccess({
  local: offlineSource('Commentary', localMhyCommentaryAccess),
  remote: resourceApiBaseUrl
    ? onlineSource(
        'Commentary',
        createHttpCommentaryAccess({
          baseUrl: resourceApiBaseUrl,
          fetcher: resourceApiFetch,
          isOnline: async () => onlineManager.isOnline(),
        })
      )
    : onlineSource('Commentary', firestoreCommentaryAccess),
  isOnline: async () => onlineManager.isOnline(),
  combineResults: !resourceApiBaseUrl,
})

export const defaultResourceAccess: ResourceAccessRegistry = {
  bibleContent: createBibleContentAccess(
    bibleChapterAdapter,
    strongBibleAccess,
    interlinearBibleAccess
  ),
  bibleReading: createHybridBibleReadingResourceAccess({
    local: offlineSource('Bible reading resources', localBibleReadingResourceAccess),
    online: onlineBibleReadingAccess,
    remotelyReadableVersions: remotelyReadableBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  }),
  bibleSearch: createHybridBibleSearchAccess({
    offline: offlineSource('Bible search', localBibleSearchAccess),
    online: onlineBibleSearchAccess,
    remotelyReadableVersions: remotelyReadableBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  }),
  dictionary: createHybridDictionaryAccess({
    offline: offlineSource('Dictionary', localDictionaryAccess),
    online: onlineDictionaryAccess,
    remotelyReadableLanguages: remotelyReadableDictionaryLanguages,
    isOnline: async () => onlineManager.isOnline(),
  }),
  lexiconBible: lexiconBibleAccess,
  nave: createHybridNaveAccess({
    offline: offlineSource('Nave', localNaveAccess),
    online: onlineNaveAccess,
    remotelyReadableLanguages: remotelyReadableNaveLanguages,
    isOnline: async () => onlineManager.isOnline(),
  }),
  strongLexicon: strongLexiconAccess,
  strongBible: strongBibleAccess,
  interlinearBible: interlinearBibleAccess,
  timeline: createHybridTimelineAccess({
    offline: offlineSource('Timeline', localTimelineAccess),
    online: onlineTimelineAccess,
    remotelyReadableLanguages: remotelyReadableTimelineLanguages,
    isOnline: async () => onlineManager.isOnline(),
  }),
  commentary: commentaryAccess,
  offlineCopies: { isAvailable: isLocalResourceAvailable },
  capabilities: {
    getOnlineAccess: identity =>
      getResourceOnlineAccess(
        identity,
        remotelyReadableBibleVersions,
        remotelyReadableNaveLanguages,
        remotelyReadableStrongBibleVersions,
        remotelyReadableInterlinearLocales,
        remotelyReadableStrongLexiconModules,
        remotelyReadableDictionaryLanguages,
        remotelyReadableCommentaryCollections,
        Boolean(resourceApiBaseUrl),
        remotelyReadableTimelineLanguages
      ),
  },
}

const ResourceAccessContext = createContext<ResourceAccessRegistry>(defaultResourceAccess)

export const ResourceAccessProvider = ({
  children,
  value = defaultResourceAccess,
}: {
  children: ReactNode
  value?: ResourceAccessRegistry
}) => <ResourceAccessContext.Provider value={value}>{children}</ResourceAccessContext.Provider>

export const useResourceAccess = () => useContext(ResourceAccessContext)
