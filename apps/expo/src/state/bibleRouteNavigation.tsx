import { createContext, useContext, type ReactNode } from 'react'

import type { Book } from '~assets/bible_versions/books-desc'
import type { StrongMode } from '~helpers/strongBiblePublications'

export type BibleRouteNavigationAdapter = {
  openChapter: (book: Book, chapter: number) => void
  replaceWithChapter: (book: Book, chapter: number) => void
  changeVersion: (version: string) => void
  changeStrongMode: (mode: StrongMode) => void
}

const BibleRouteNavigationContext = createContext<BibleRouteNavigationAdapter | undefined>(
  undefined
)

export const BibleRouteNavigationProvider = ({
  adapter,
  children,
}: {
  adapter?: BibleRouteNavigationAdapter
  children: ReactNode
}) =>
  adapter ? (
    <BibleRouteNavigationContext.Provider value={adapter}>
      {children}
    </BibleRouteNavigationContext.Provider>
  ) : (
    children
  )

export const useBibleRouteNavigation = (): BibleRouteNavigationAdapter | undefined =>
  useContext(BibleRouteNavigationContext)
