import Constants from 'expo-constants'
import { onlineManager } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'

import { createBibleContentAccess, type BibleContentAccess } from './bibleContentAccess'
import {
  createHttpBibleChapterAdapter,
  getConfiguredResourceApiBaseUrl,
  unavailableHttpBibleChapterAdapter,
} from './bibleChapterSource'
import {
  createHttpBibleReadingResourceAccess,
  type BibleReadingResourceAccess,
} from './bibleReadingResourceAccess'
import { createHttpBibleSearchAccess, type BibleSearchAccess } from './bibleSearchAccess'
import { createHttpDictionaryAccess, type DictionaryAccess } from './dictionaryAccess'
import { createHttpNaveAccess, type NaveAccess } from './naveAccess'
import { createHttpStrongLexiconAccess, type StrongLexiconAccess } from './strongLexiconAccess'
import {
  createHttpStrongBibleResourceAdapter,
  createStrongBibleResourceAccess,
  type StrongBibleResourceAdapter,
  type StrongBibleResourceAccess,
} from './strongBibleResourceAccess'
import {
  createHybridInterlinearLexiconAdapter,
  createLexiconBibleResourceAccess,
  type LexiconBibleResourceAccess,
} from './lexiconBibleResourceAccess'
import {
  createHttpInterlinearBibleResourceAdapter,
  type InterlinearBibleResourceAccess,
} from './interlinearBibleResourceAccess'
import { createHttpTimelineAccess, type TimelineAccess } from './timelineAccess'
import {
  createCommentaryAccess,
  createHttpCommentaryChapterSource,
  type CommentaryAccess,
  type CommentaryChapterSource,
} from './commentaryAccess'
import { ResourceAccessError } from './resourceAccessError'
import {
  getResourceOnlineAccess,
  type OnlineAccessState,
  type ResourceIdentity,
} from './resourceModel'
import type { LocalResourceRef } from './resourceAvailability'
import { ONLINE_BIBLE_VERSION_IDS } from '~helpers/ordinaryBibleVersions'
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
  offlineCopies: { isAvailable: (identity: LocalResourceRef) => Promise<boolean> }
  capabilities: { getOnlineAccess: (identity: ResourceIdentity) => OnlineAccessState }
}

const isOnline = async () => onlineManager.isOnline()
const resourceApiBaseUrl = getConfiguredResourceApiBaseUrl(
  Constants.expoConfig?.extra?.resourceApiUrl as string | undefined
)

const unavailableAccess = <Access extends object>(): Access =>
  new Proxy(
    {},
    {
      get: () => async () => {
        throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
      },
    }
  ) as Access

const bibleVersions = new Set(resourceApiBaseUrl ? ONLINE_BIBLE_VERSION_IDS : [])
const strongBibleVersions = new Set(resourceApiBaseUrl ? STRONG_BIBLE_FALLBACK_PRIORITY : [])
const languages = new Set<ResourceLanguage>(resourceApiBaseUrl ? ['fr', 'en'] : [])
const strongLexiconModules = new Set(resourceApiBaseUrl ? ['core', 'resources', 'entities'] : [])
const commentaryCollections = new Set(resourceApiBaseUrl ? ['MHY'] : [])

const bibleChapter = resourceApiBaseUrl
  ? createHttpBibleChapterAdapter({ baseUrl: resourceApiBaseUrl, isOnline })
  : unavailableHttpBibleChapterAdapter

const strongLexicon = resourceApiBaseUrl
  ? createHttpStrongLexiconAccess({ baseUrl: resourceApiBaseUrl, isOnline })
  : unavailableAccess<StrongLexiconAccess>()

const strongBibleAdapter = resourceApiBaseUrl
  ? createHttpStrongBibleResourceAdapter({
      baseUrl: resourceApiBaseUrl,
      isOnline,
      bibleChapterAdapter: bibleChapter,
    })
  : unavailableAccess<StrongBibleResourceAdapter>()
const strongBible = createStrongBibleResourceAccess(strongBibleAdapter)

const interlinearBible = resourceApiBaseUrl
  ? createHttpInterlinearBibleResourceAdapter({
      baseUrl: resourceApiBaseUrl,
      isOnline,
      bibleChapterAdapter: bibleChapter,
    })
  : unavailableAccess<InterlinearBibleResourceAccess>()

const bibleContent = createBibleContentAccess(bibleChapter, strongBible, interlinearBible)

const bibleReading: BibleReadingResourceAccess = resourceApiBaseUrl
  ? {
      ...createHttpBibleReadingResourceAccess({ baseUrl: resourceApiBaseUrl, isOnline }),
      getRedWordsAvailability: async () => ({ status: 'unsupported' }),
      loadRedWords: async () => null,
    }
  : unavailableAccess<BibleReadingResourceAccess>()

const bibleSearch = resourceApiBaseUrl
  ? createHttpBibleSearchAccess({
      baseUrl: resourceApiBaseUrl,
      versions: [...bibleVersions],
      isOnline,
    })
  : unavailableAccess<BibleSearchAccess>()

const dictionary = resourceApiBaseUrl
  ? createHttpDictionaryAccess({ baseUrl: resourceApiBaseUrl, isOnline })
  : unavailableAccess<DictionaryAccess>()
const nave = resourceApiBaseUrl
  ? createHttpNaveAccess({ baseUrl: resourceApiBaseUrl, isOnline })
  : unavailableAccess<NaveAccess>()
const timeline = resourceApiBaseUrl
  ? createHttpTimelineAccess({ baseUrl: resourceApiBaseUrl, isOnline })
  : unavailableAccess<TimelineAccess>()
const commentary = resourceApiBaseUrl
  ? createCommentaryAccess({
      local: unavailableAccess<CommentaryChapterSource>(),
      remote: createHttpCommentaryChapterSource({ baseUrl: resourceApiBaseUrl, isOnline }),
      isOnline,
    })
  : unavailableAccess<CommentaryAccess>()

const hybridInterlinearLexicon = createHybridInterlinearLexiconAdapter(
  interlinearBible,
  bibleChapter
)
const lexiconBible = createLexiconBibleResourceAccess({
  strongBible,
  interlinear: {
    ...hybridInterlinearLexicon,
    loadCountsByBook: async () => {
      throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
    },
    loadFoundVersesByBook: async () => {
      throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
    },
  },
})

export const defaultResourceAccess: ResourceAccessRegistry = {
  bibleContent: {
    ...bibleContent,
    getAvailability: async version =>
      bibleVersions.has(version) ? { status: 'available' } : { status: 'unavailable' },
  },
  bibleReading,
  bibleSearch,
  dictionary,
  lexiconBible,
  nave,
  strongLexicon,
  strongBible,
  interlinearBible,
  timeline,
  commentary,
  offlineCopies: { isAvailable: async () => false },
  capabilities: {
    getOnlineAccess: identity =>
      getResourceOnlineAccess(
        identity,
        bibleVersions,
        languages,
        strongBibleVersions,
        languages,
        strongLexiconModules,
        languages,
        commentaryCollections,
        Boolean(resourceApiBaseUrl),
        languages
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
