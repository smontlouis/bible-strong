import { createContext, useContext, ReactNode } from 'react'
import type { ResourceFailurePresentation } from '~features/resources/resourceFailure'

export interface BibleDOMTranslations {
  // Error messages for parallel versions
  parallelVersionNotFound: string
  parallelChapterNotFound: string
  parallelLoadError: string
  exitFocus: string
  // Error/download state
  resourceFailureDetails: Record<ResourceFailurePresentation['detailKey'], string>
  goToDownloads: string
  downloadVersion: string
  repairOfflineCopy: string
  connectionRequired: string
  downloading: string
  inserting: string
  resetDatabase: string
  retry: string
  openCanonicalBibleNote: string
  pericopeIndex: string
  passageMediaTitle: string
  passageMediaClose: string
  passageMediaBookName: string
  passageMediaChapter: number
  passageMediaSections: {
    introduction: string
    passages: string
    chapterResources: string
  }
}

const TranslationsContext = createContext<BibleDOMTranslations | null>(null)

export const TranslationsProvider = ({
  children,
  translations,
}: {
  children: ReactNode
  translations: BibleDOMTranslations
}) => <TranslationsContext.Provider value={translations}>{children}</TranslationsContext.Provider>

export const useTranslations = () => {
  const context = useContext(TranslationsContext)
  if (!context) {
    throw new Error('useTranslations must be used within TranslationsProvider')
  }
  return context
}
