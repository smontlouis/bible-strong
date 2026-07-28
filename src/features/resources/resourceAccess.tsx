import { createContext, useContext, type ReactNode } from 'react'
import {
  localBibleContentAccess,
  type BibleContentAccess,
} from '~features/resources/bibleContentAccess'
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

export type ResourceAccessRegistry = {
  bibleContent: BibleContentAccess
  bibleReading: BibleReadingResourceAccess
  bibleSearch: BibleSearchAccess
  dictionary: DictionaryAccess
  lexiconBible: LexiconBibleResourceAccess
  nave: NaveAccess
  strongLexicon: StrongLexiconAccess
  strongBible: StrongBibleResourceAccess
}

export const defaultResourceAccess: ResourceAccessRegistry = {
  bibleContent: localBibleContentAccess,
  bibleReading: localBibleReadingResourceAccess,
  bibleSearch: localBibleSearchAccess,
  dictionary: localDictionaryAccess,
  lexiconBible: localLexiconBibleResourceAccess,
  nave: localNaveAccess,
  strongLexicon: localStrongLexiconAccess,
  strongBible: localStrongBibleResourceAccess,
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
