import { createContext, useContext, ReactNode } from 'react'

export interface BibleDOMTranslations {
  // Error messages for parallel versions
  parallelVersionNotFound: string
  parallelChapterNotFound: string
  parallelLoadError: string
  // Readonly mode
  readWholeChapter: string
}

const TranslationsContext = createContext<BibleDOMTranslations | null>(null)

export const TranslationsProvider = ({
  children,
  translations,
}: {
  children: ReactNode
  translations: BibleDOMTranslations
}) => (
  <TranslationsContext.Provider value={translations}>
    {children}
  </TranslationsContext.Provider>
)

export const useTranslations = () => {
  const context = useContext(TranslationsContext)
  if (!context) {
    throw new Error('useTranslations must be used within TranslationsProvider')
  }
  return context
}
