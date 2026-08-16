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
  localBibleReadingResourceAccess,
  type BibleReadingResourceAccess,
} from '~features/resources/bibleReadingResourceAccess'
import {
  localBibleSearchAccess,
  type BibleSearchAccess,
} from '~features/resources/bibleSearchAccess'
import { localDictionaryAccess, type DictionaryAccess } from '~features/resources/dictionaryAccess'
import { localNaveAccess, type NaveAccess } from '~features/resources/naveAccess'
import {
  localStrongLexiconAccess,
  type StrongLexiconAccess,
} from '~features/resources/strongLexiconAccess'
import {
  localStrongBibleResourceAccess,
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
import { configureDevelopmentResourceArtifactBaseUrl } from '~helpers/mobileResourceCatalog'

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

export const defaultResourceAccess: ResourceAccessRegistry = {
  bibleContent: createBibleContentAccess(
    createHybridBibleChapterAdapter({
      offline: localBibleChapterAdapter,
      online: onlineBibleChapterAdapter,
    })
  ),
  bibleReading: localBibleReadingResourceAccess,
  bibleSearch: localBibleSearchAccess,
  dictionary: localDictionaryAccess,
  lexiconBible: localLexiconBibleResourceAccess,
  nave: localNaveAccess,
  strongLexicon: localStrongLexiconAccess,
  strongBible: localStrongBibleResourceAccess,
  timeline: localTimelineAccess,
  commentary: defaultCommentaryAccess,
  offlineCopies: { isAvailable: isLocalResourceAvailable },
  capabilities: {
    getOnlineAccess: identity =>
      getResourceOnlineAccess(identity, resourceApiBaseUrl ? new Set(['LSG']) : new Set()),
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
