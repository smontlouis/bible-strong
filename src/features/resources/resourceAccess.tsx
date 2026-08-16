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
  localLexiconBibleResourceAccess,
  type LexiconBibleResourceAccess,
} from '~features/resources/lexiconBibleResourceAccess'
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
  getMobileBibleVersionIds,
} from '~helpers/mobileResourceCatalog'
import { PUBLIC_ONLINE_BIBLE_VERSION_IDS } from '~helpers/ordinaryBibleVersions'
import { STRONG_BIBLE_FALLBACK_PRIORITY } from '~helpers/strongBiblePublications'

export type ResourceAccessRegistry = {
  bibleContent: BibleContentAccess
  bibleReading: BibleReadingResourceAccess
  bibleSearch: BibleSearchAccess
  dictionary: DictionaryAccess
  lexiconBible: LexiconBibleResourceAccess
  nave: NaveAccess
  strongLexicon: StrongLexiconAccess
  strongBible: StrongBibleResourceAccess
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
configureDevelopmentResourceArtifactBaseUrl(
  Constants.expoConfig?.extra?.resourceArtifactBaseUrl as string | undefined
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
  bibleContent: createBibleContentAccess(bibleChapterAdapter, strongBibleAccess),
  bibleReading: createHybridBibleReadingResourceAccess({
    local: localBibleReadingResourceAccess,
    online: onlineBibleReadingAccess,
    remotelyReadableVersions: remotelyReadableBibleVersions,
    isOnline: async () => onlineManager.isOnline(),
  }),
  bibleSearch: localBibleSearchAccess,
  dictionary: localDictionaryAccess,
  lexiconBible: localLexiconBibleResourceAccess,
  nave: createHybridNaveAccess({
    offline: localNaveAccess,
    online: onlineNaveAccess,
    remotelyReadableLanguages: resourceApiBaseUrl ? new Set(['fr']) : new Set(),
    isOnline: async () => onlineManager.isOnline(),
  }),
  strongLexicon: localStrongLexiconAccess,
  strongBible: strongBibleAccess,
  timeline: localTimelineAccess,
  commentary: defaultCommentaryAccess,
  offlineCopies: { isAvailable: isLocalResourceAvailable },
  capabilities: {
    getOnlineAccess: identity =>
      getResourceOnlineAccess(
        identity,
        remotelyReadableBibleVersions,
        resourceApiBaseUrl ? new Set(['fr']) : new Set(),
        remotelyReadableStrongBibleVersions
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
