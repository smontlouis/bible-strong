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
  unavailableHttpBibleChapterAdapter,
} from '~features/resources/bibleChapterSource'
import {
  createHttpBibleReadingResourceAccess,
  createHybridBibleReadingResourceAccess,
  localBibleReadingResourceAccess,
  type BibleReadingResourceAccess,
} from '~features/resources/bibleReadingResourceAccess'
import {
  localBibleSearchAccess,
  type BibleSearchAccess,
} from '~features/resources/bibleSearchAccess'
import { localDictionaryAccess, type DictionaryAccess } from '~features/resources/dictionaryAccess'
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
import { localTimelineAccess, type TimelineAccess } from '~features/resources/timelineAccess'
import {
  defaultCommentaryAccess,
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
  configureDevelopmentResourceArtifactBaseUrl,
  getDevelopmentResourceArtifactBaseUrl,
  getMobileBibleVersionIds,
} from '~helpers/mobileResourceCatalog'
import { PUBLIC_ONLINE_BIBLE_VERSION_IDS } from '~helpers/ordinaryBibleVersions'
import { STRONG_BIBLE_FALLBACK_PRIORITY } from '~helpers/strongBiblePublications'
import type { ResourceLanguage } from '~helpers/databaseTypes'

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
const localDevelopmentApiBaseUrl = getDevelopmentResourceApiBaseUrl(
  Platform.OS as 'ios' | 'android' | 'web'
)
configureDevelopmentResourceArtifactBaseUrl(
  configuredResourceArtifactBaseUrl ??
    (__DEV__ && resourceApiBaseUrl === localDevelopmentApiBaseUrl
      ? getDevelopmentResourceArtifactBaseUrl(Platform.OS as 'ios' | 'android' | 'web')
      : undefined)
)
const onlineBibleChapterAdapter = resourceApiBaseUrl
  ? createHttpBibleChapterAdapter({
      baseUrl: resourceApiBaseUrl,
      isOnline: async () => onlineManager.isOnline(),
    })
  : unavailableHttpBibleChapterAdapter
const bibleChapterAdapter = createHybridBibleChapterAdapter({
  offline: localBibleChapterAdapter,
  online: onlineBibleChapterAdapter,
})
const onlineNaveAccess = resourceApiBaseUrl
  ? createHttpNaveAccess({
      baseUrl: resourceApiBaseUrl,
      isOnline: async () => onlineManager.isOnline(),
    })
  : unavailableHttpNaveAccess
const remotelyReadableStrongBibleVersions = new Set(
  resourceApiBaseUrl ? STRONG_BIBLE_FALLBACK_PRIORITY : []
)
const onlineStrongBibleAdapter = resourceApiBaseUrl
  ? createHttpStrongBibleResourceAdapter({
      baseUrl: resourceApiBaseUrl,
      isOnline: async () => onlineManager.isOnline(),
      bibleChapterAdapter,
    })
  : localStrongBibleResourceAdapter
const strongBibleAccess = createStrongBibleResourceAccess(
  createHybridStrongBibleResourceAdapter({
    offline: localStrongBibleResourceAdapter,
    online: onlineStrongBibleAdapter,
    remotelyReadableVersions: remotelyReadableStrongBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  })
)
const remotelyReadableInterlinearLocales = new Set<ResourceLanguage>(
  resourceApiBaseUrl ? ['fr', 'en'] : []
)
const onlineInterlinearBibleAdapter = resourceApiBaseUrl
  ? createHttpInterlinearBibleResourceAdapter({
      baseUrl: resourceApiBaseUrl,
      isOnline: async () => onlineManager.isOnline(),
      bibleChapterAdapter,
    })
  : localInterlinearBibleResourceAdapter
const interlinearBibleAccess = createHybridInterlinearBibleResourceAdapter({
  offline: localInterlinearBibleResourceAdapter,
  online: onlineInterlinearBibleAdapter,
  remotelyReadableLocales: remotelyReadableInterlinearLocales,
  isOnline: async () => onlineManager.isOnline(),
})
const lexiconBibleAccess = createLexiconBibleResourceAccess({
  strongBible: strongBibleAccess,
  interlinear: createHybridInterlinearLexiconAdapter(interlinearBibleAccess, bibleChapterAdapter),
})
const strongLexiconAccess = createHybridStrongLexiconAccess({
  offline: localStrongLexiconAccess,
  online: resourceApiBaseUrl
    ? createHttpStrongLexiconAccess({
        baseUrl: resourceApiBaseUrl,
        isOnline: async () => onlineManager.isOnline(),
      })
    : localStrongLexiconAccess,
  remotelyReadable: Boolean(resourceApiBaseUrl),
  isOnline: async () => onlineManager.isOnline(),
})
const remotelyReadableStrongLexiconModules = new Set(
  resourceApiBaseUrl ? ['core', 'resources', 'entities'] : []
)
const remotelyReadableBibleVersions = new Set(
  resourceApiBaseUrl ? (__DEV__ ? getMobileBibleVersionIds() : PUBLIC_ONLINE_BIBLE_VERSION_IDS) : []
)
const onlineBibleReadingAccess = resourceApiBaseUrl
  ? createHttpBibleReadingResourceAccess({
      baseUrl: resourceApiBaseUrl,
      isOnline: async () => onlineManager.isOnline(),
    })
  : {
      getPericopeAvailability: async () => ({ status: 'unsupported' as const }),
      loadPericope: async () => {
        throw new Error('BIBLE_PERICOPE_HTTP_UNCONFIGURED')
      },
    }

export const defaultResourceAccess: ResourceAccessRegistry = {
  bibleContent: createBibleContentAccess(
    bibleChapterAdapter,
    strongBibleAccess,
    interlinearBibleAccess,
    strongLexiconAccess
  ),
  bibleReading: createHybridBibleReadingResourceAccess({
    local: localBibleReadingResourceAccess,
    online: onlineBibleReadingAccess,
    remotelyReadableVersions: remotelyReadableBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  }),
  bibleSearch: localBibleSearchAccess,
  dictionary: localDictionaryAccess,
  lexiconBible: lexiconBibleAccess,
  nave: createHybridNaveAccess({
    offline: localNaveAccess,
    online: onlineNaveAccess,
    remotelyReadableLanguages: resourceApiBaseUrl ? new Set(['fr']) : new Set(),
    isOnline: async () => onlineManager.isOnline(),
  }),
  strongLexicon: strongLexiconAccess,
  strongBible: strongBibleAccess,
  interlinearBible: interlinearBibleAccess,
  timeline: localTimelineAccess,
  commentary: defaultCommentaryAccess,
  offlineCopies: { isAvailable: isLocalResourceAvailable },
  capabilities: {
    getOnlineAccess: identity =>
      getResourceOnlineAccess(
        identity,
        remotelyReadableBibleVersions,
        resourceApiBaseUrl ? new Set(['fr']) : new Set(),
        remotelyReadableStrongBibleVersions,
        remotelyReadableInterlinearLocales,
        remotelyReadableStrongLexiconModules
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
